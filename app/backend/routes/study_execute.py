import sys
import json
import logging
import os
import uuid
from queue import Queue
from threading import Thread
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse

from phenex.util.serialization.from_dict import from_dict

from ..database import db_manager
from ..utils.auth import get_authenticated_user_id
from ..routes.execute import prepare_cohort_for_phenex

router = APIRouter()
logger = logging.getLogger(__name__)

STUDY_ARTIFACTS_DIR = os.environ.get("STUDY_ARTIFACTS_DIR", "/data/study_artifacts")


@router.post("/study/execute", tags=["study"])
async def execute_study(request: Request):
    """
    Execute all cohorts in a study with streaming output.

    Request Body:
    - study_id (str): ID of the study to execute
    - database_config (dict): Database connection and mapper configuration

    Returns:
    - StreamingResponse: Server-Sent Events stream with log messages.
      Final event includes execution_id for tracking.

    Raises:
    - 401: If user is not authenticated
    - 404: If study not found or user has no access
    - 500: If execution fails
    """
    user_id = get_authenticated_user_id(request)

    body = await request.json()
    study_id = body.get("study_id")
    database_config = body.get("database_config")

    if not study_id:
        raise HTTPException(status_code=400, detail="study_id is required")
    if not database_config:
        raise HTTPException(status_code=400, detail="database_config is required")

    study = await db_manager.get_study_for_user(user_id, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    cohorts = await db_manager.get_cohorts_for_study(study_id, user_id)
    if not cohorts:
        raise HTTPException(status_code=400, detail="Study has no cohorts to execute")

    # Load full cohort data for each cohort
    full_cohorts = []
    for c in cohorts:
        cohort_data = await db_manager.get_cohort_for_user(user_id, c["id"])
        if cohort_data:
            full_cohorts.append(cohort_data)

    execution_id = str(uuid.uuid4())
    artifacts_dir = os.path.join(STUDY_ARTIFACTS_DIR, study_id)

    await db_manager.save_study_execution(
        execution_id=execution_id,
        study_id=study_id,
        user_id=user_id,
    )

    async def stream_execution():
        output_queue = Queue()
        final_result = {}

        def run_execution():
            old_stdout = sys.stdout
            old_stderr = sys.stderr

            class StreamCapture:
                def __init__(self, queue, prefix=""):
                    self.queue = queue
                    self.prefix = prefix

                def write(self, text):
                    if text.strip():
                        self.queue.put(f"{self.prefix}{text}")
                    return len(text)

                def flush(self):
                    pass

            class QueueHandler(logging.Handler):
                def __init__(self, queue):
                    super().__init__()
                    self.queue = queue

                def emit(self, record):
                    try:
                        msg = self.format(record)
                        self.queue.put(f"[{record.levelname}] {msg}")
                    except Exception:
                        self.handleError(record)

            queue_handler = QueueHandler(output_queue)
            queue_handler.setFormatter(logging.Formatter("%(name)s - %(message)s"))

            root_logger = logging.getLogger()
            original_handlers = root_logger.handlers.copy()
            original_level = root_logger.level
            root_logger.handlers.clear()
            root_logger.addHandler(queue_handler)
            root_logger.setLevel(logging.INFO)

            phenex_logger = logging.getLogger("phenex")
            phenex_original_handlers = phenex_logger.handlers.copy()
            phenex_logger.handlers.clear()
            phenex_logger.addHandler(queue_handler)
            phenex_logger.setLevel(logging.INFO)
            phenex_logger.propagate = True

            sys.stdout = StreamCapture(output_queue, "[STDOUT] ")
            sys.stderr = StreamCapture(output_queue, "[STDERR] ")

            try:
                print(f"Starting study execution: {study.get('name', study_id)}")
                logger.info(f"Executing study '{study.get('name')}' ({study_id})")

                if database_config["mapper"] == "OMOP":
                    from phenex.mappers import OMOPDomains
                    mapper = OMOPDomains
                    print("Using OMOP mapper")

                db_cfg = database_config["config"]
                print("Creating database connection...")

                try:
                    from phenex.connectors.snowflake import SnowflakeConnector
                    con = SnowflakeConnector(
                        SNOWFLAKE_SOURCE_DATABASE=db_cfg["source_database"],
                        SNOWFLAKE_DEST_DATABASE=db_cfg["destination_database"],
                    )
                except ImportError:
                    raise RuntimeError("Snowflake connector not available")

                print("Database connection established")
                mapped_tables = mapper.get_mapped_tables(con)
                print(f"Found {len(mapped_tables)} mapped tables")

                px_cohorts = []
                for cohort_data in full_cohorts:
                    cohort_name = cohort_data.get("name", cohort_data.get("id", "unknown"))
                    print(f"Preparing cohort: {cohort_name}")
                    processed = prepare_cohort_for_phenex(cohort_data, user_id)
                    px_cohort = from_dict(processed)
                    px_cohort.database = mapped_tables
                    px_cohorts.append(px_cohort)

                from phenex.core.study import Study

                print(f"Creating Study object, artifacts will be saved to {artifacts_dir}")
                os.makedirs(artifacts_dir, exist_ok=True)

                px_study = Study(
                    path=artifacts_dir,
                    name=study.get("name", study_id),
                    cohorts=px_cohorts,
                    description=study.get("description", ""),
                )

                print("Executing study...")
                logger.info("Starting study execution...")
                px_study.execute()
                print("Study execution completed!")
                logger.info("Study execution completed successfully")

                # Determine the timestamped execution directory created by Study
                exec_dirs = sorted(
                    [
                        d for d in os.listdir(px_study.path)
                        if os.path.isdir(os.path.join(px_study.path, d)) and d.startswith("D")
                    ],
                    reverse=True,
                )
                exec_dir = os.path.join(px_study.path, exec_dirs[0]) if exec_dirs else px_study.path

                # Write manifest.json listing all generated artifacts
                manifest = {
                    "execution_id": execution_id,
                    "study_id": study_id,
                    "study_name": study.get("name"),
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "artifacts_dir": exec_dir,
                    "files": [],
                }
                for root, dirs, files in os.walk(exec_dir):
                    for fname in files:
                        fpath = os.path.join(root, fname)
                        manifest["files"].append(
                            os.path.relpath(fpath, exec_dir)
                        )

                manifest_path = os.path.join(exec_dir, "manifest.json")
                with open(manifest_path, "w") as f:
                    json.dump(manifest, f, indent=4)

                final_result["execution_id"] = execution_id
                final_result["manifest_path"] = manifest_path
                final_result["status"] = "success"

            except Exception as e:
                import traceback
                err = f"Study execution failed: {str(e)}\n{traceback.format_exc()}"
                print(f"ERROR: {err}")
                final_result["status"] = "failure"
                final_result["error"] = str(e)
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                root_logger.handlers.clear()
                for h in original_handlers:
                    root_logger.addHandler(h)
                root_logger.setLevel(original_level)
                phenex_logger.handlers.clear()
                for h in phenex_original_handlers:
                    phenex_logger.addHandler(h)
                output_queue.put(None)  # sentinel

        thread = Thread(target=run_execution, daemon=True)
        thread.start()

        import asyncio

        while True:
            try:
                msg = output_queue.get(timeout=0.1)
                if msg is None:
                    break
                yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
            except Exception:
                if not thread.is_alive():
                    break
                await asyncio.sleep(0.05)

        thread.join()

        # Persist execution result to DB
        try:
            import asyncpg
            await db_manager.update_study_execution(
                execution_id=execution_id,
                status=final_result.get("status", "failure"),
                manifest_path=final_result.get("manifest_path"),
                error_message=final_result.get("error"),
            )
        except Exception as db_err:
            logger.error(f"Failed to update study_execution record: {db_err}")

        if final_result.get("status") == "failure":
            yield f"data: {json.dumps({'type': 'error', 'message': final_result.get('error', 'Unknown error')})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'complete', 'execution_id': execution_id})}\n\n"

    return StreamingResponse(
        stream_execution(),
        media_type="text/event-stream",
        headers={
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/study/{study_id}/executions", tags=["study"])
async def get_study_executions(request: Request, study_id: str):
    """
    Get execution history for a study.

    Returns:
    - list[dict]: List of execution records ordered by start time desc.
    """
    user_id = get_authenticated_user_id(request)
    try:
        return await db_manager.get_study_executions(study_id, user_id)
    except Exception as e:
        logger.error(f"Failed to get study executions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve study executions")
