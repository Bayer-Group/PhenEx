import sys
import logging
from typing import Dict
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from phenex.util.serialization.from_dict import from_dict

try:
    from phenex.connectors.snowflake import SnowflakeConnector
except ImportError:
    # Snowflake connector may not be available in all environments
    SnowflakeConnector = None

# Import database manager, authentication utilities, and codelist functions
from ..database import db_manager
from ..utils.auth import get_authenticated_user_id
from ..routes.codelist import get_codelist_file_for_cohort
from ..utils.validation import validate_cohort_data_format

# Create router for cohort execution endpoint
router = APIRouter()

# Setup logger
logger = logging.getLogger(__name__)


@router.post("/execute", tags=["cohort"])
async def execute_cohort(
    request: Request,
    cohort: Dict = None,
    database_config: Dict = None,
):
    """
    Execute a cohort against a database with streaming output.

    Request Body:
    - cohort (dict): Complete cohort specification in phenotypes-only format
    - database_config (dict): Database connection and mapper configuration

    Authentication:
    - Requires authenticated user. Execution runs with authenticated user's permissions.

    Cohort Data Format Requirements:
    - Cohort MUST contain a 'phenotypes' array
    - Each phenotype must have a 'type' field (entry, inclusion, exclusion, baseline, outcome, component)
    - During execution, phenotypes array is converted to structured format for PhenEx library

    Example Request Body:
    ```json
    {
        "cohort": {
            "id": "cohort_123",
            "name": "Type 2 Diabetes Cohort",
            "phenotypes": [
                {
                    "id": "pheno_1",
                    "type": "entry",
                    "name": "T2DM Diagnosis",
                    "class_name": "CodelistPhenotype",
                    "codelist": {...}
                },
                {
                    "id": "pheno_2",
                    "type": "inclusion",
                    "name": "Age >= 18",
                    "class_name": "MeasurementPhenotype",
                    ...
                }
            ]
        },
        "database_config": {
            "mapper": "OMOP",
            "config": {
                "source_database": "omop_db",
                "destination_database": "results_db"
            }
        }
    }
    ```

    Returns:
    - StreamingResponse: Server-Sent Events (SSE) stream containing:
        - Log messages: `{"type": "log", "message": "..."}`
        - Error messages: `{"type": "error", "message": "..."}`
        - Final results: `{"type": "result", "data": {...}}`
        - Completion marker: `{"type": "complete"}`

    Final Result Structure:
    ```json
    {
        "type": "result",
        "data": {
            "cohort": {
                ...original cohort with added count fields...,
                "table1": {...baseline characteristics table...},
                "waterfall": {...attrition/waterfall report...}
            }
        }
    }
    ```

    Raises:
    - 401: If user is not authenticated
    - 422: If cohort data format is invalid
    - 500: If execution fails (streamed as error message)
    """
    # Get authenticated user_id and add it to cohort
    user_id = get_authenticated_user_id(request)

    # Validate cohort data format before execution
    if cohort:
        try:
            validate_cohort_data_format(cohort)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        cohort["user_id"] = user_id

    import sys
    import asyncio
    from queue import Queue
    import threading
    import json

    async def stream_execution():
        # Create a queue to capture output
        output_queue = Queue()
        final_result = {}

        def capture_output():
            # Capture stdout and stderr
            old_stdout = sys.stdout
            old_stderr = sys.stderr

            # Capture logging output
            import logging

            class StreamCapture:
                def __init__(self, queue, prefix=""):
                    self.queue = queue
                    self.prefix = prefix

                def write(self, text):
                    if text.strip():  # Only send non-empty lines
                        self.queue.put(f"{self.prefix}{text}")
                    return len(text)

                def flush(self):
                    pass

            # Custom logging handler to capture log messages
            class QueueHandler(logging.Handler):
                def __init__(self, queue):
                    super().__init__()
                    self.queue = queue

                def emit(self, record):
                    try:
                        log_message = self.format(record)
                        level_name = record.levelname
                        self.queue.put(f"[{level_name}] {log_message}")
                    except Exception:
                        self.handleError(record)

            # Set up logging capture
            queue_handler = QueueHandler(output_queue)
            queue_handler.setFormatter(logging.Formatter("%(name)s - %(message)s"))

            # Get the root logger and add our handler
            root_logger = logging.getLogger()
            original_level = root_logger.level
            original_handlers = root_logger.handlers.copy()

            # Also specifically capture phenex logger messages
            phenex_logger = logging.getLogger("phenex")
            phenex_original_level = phenex_logger.level
            phenex_original_handlers = phenex_logger.handlers.copy()

            # Also capture the main app logger specifically
            app_logger = logging.getLogger(__name__)
            app_original_level = app_logger.level
            app_original_handlers = app_logger.handlers.copy()

            # Clear existing handlers and add our queue handler
            root_logger.handlers.clear()
            root_logger.addHandler(queue_handler)
            root_logger.setLevel(logging.INFO)  # Capture all log levels

            # Ensure phenex logger also uses our handler
            phenex_logger.handlers.clear()
            phenex_logger.addHandler(queue_handler)
            phenex_logger.setLevel(logging.INFO)
            phenex_logger.propagate = True  # Ensure messages propagate to root logger

            # Ensure app logger also uses our handler
            app_logger.handlers.clear()
            app_logger.addHandler(queue_handler)
            app_logger.setLevel(logging.INFO)
            app_logger.propagate = True  # Ensure messages propagate to root logger

            sys.stdout = StreamCapture(output_queue, "[STDOUT] ")
            sys.stderr = StreamCapture(output_queue, "[STDERR] ")

            try:
                print(f"Starting execution for cohort: {cohort.get('name', 'Unknown')}")
                logger.info(
                    f"Starting execution for cohort: {cohort.get('name', 'Unknown')}"
                )
                print(f"Database config: {database_config}")
                logger.info(f"Database configuration: {database_config}")

                if database_config["mapper"] == "OMOP":
                    from phenex.mappers import OMOPDomains

                    mapper = OMOPDomains
                    print("Using OMOP mapper")
                    logger.info("Using OMOP mapper")

                database = database_config["config"]
                print("Creating database connection...")
                logger.info("Creating Snowflake database connection...")

                con = SnowflakeConnector(
                    SNOWFLAKE_SOURCE_DATABASE=database["source_database"],
                    SNOWFLAKE_DEST_DATABASE=database["destination_database"],
                )
                print("Database connection established")
                logger.info("Database connection established successfully")

                print("Getting mapped tables...")
                logger.info("Retrieving mapped tables from database...")
                mapped_tables = mapper.get_mapped_tables(con)
                print(f"Found {len(mapped_tables)} mapped tables")
                logger.info(
                    f"Successfully retrieved {len(mapped_tables)} mapped tables"
                )

                print("Preparing cohort for phenex...")
                logger.info("Converting cohort data structure for phenex processing...")

                # Extract user_id from cohort before processing
                user_id = cohort.get("user_id")
                if not user_id:
                    logger.warning(
                        "No user_id found in cohort, some operations may fail"
                    )

                print("🏥 PREPARING COHORT FOR PHENEX...")
                logger.info("🏥 PREPARING COHORT FOR PHENEX...")
                processed_cohort = prepare_cohort_for_phenex(cohort, user_id)
                print("🏥 COHORT PREPARATION COMPLETED!")
                logger.info("🏥 COHORT PREPARATION COMPLETED!")

                print("Saving processed cohort...")
                logger.info("Saving processed cohort to processed_cohort.json")
                with open("./processed_cohort.json", "w") as f:
                    json.dump(processed_cohort, f, indent=4)

                print("Creating phenex cohort object...")
                logger.info(
                    f"Creating phenex cohort object from processed data... AND MODIFIED {sys.path}"
                )
                px_cohort = from_dict(processed_cohort)

                logger.info("Saving cohort object to cohort.json")
                with open("./cohort.json", "w") as f:
                    json.dump(px_cohort.to_dict(), f, indent=4)

                print("Executing cohort...")
                logger.info("Starting cohort execution against mapped tables...")
                px_cohort.execute(
                    tables=mapped_tables
                )  # , con = con, n_threads=6, overwrite=True, lazy_execution=True)
                print("Appending counts...")
                logger.info("Appending patient counts to cohort results...")
                px_cohort.append_counts()

                print("Generating table1...")
                logger.info("Generating Table 1 (baseline characteristics)...")

                print("Generating waterfall report...")
                logger.info("Generating waterfall/attrition report...")
                from phenex.reporting import Waterfall

                r = Waterfall(pretty_display=False, decimal_places=2)
                df_waterfall = r.execute(px_cohort)

                print("Finalizing results...")
                logger.info("Finalizing and formatting results for return...")
                append_count_to_cohort(px_cohort, cohort)

                from json import loads

                cohort["table1"] = loads(px_cohort.table1.to_json(orient="split"))
                cohort["waterfall"] = loads(df_waterfall.to_json(orient="split"))

                # Convert back to phenotypes-only format for frontend
                print("Converting results back to phenotypes-only format...")
                logger.info(
                    "Converting cohort from structured format back to phenotypes array for frontend..."
                )
                cohort = convert_structured_to_phenotypes(cohort)

                final_result["cohort"] = cohort

                print("Execution completed successfully!")
                logger.info("Cohort execution completed successfully!")

            except Exception as e:
                print(f"ERROR: {str(e)}")
                import traceback

                print(f"TRACEBACK: {traceback.format_exc()}")
                final_result["error"] = str(e)
            finally:
                # Restore original stdout/stderr
                sys.stdout = old_stdout
                sys.stderr = old_stderr

                # Restore original logging configuration
                root_logger.handlers.clear()
                for handler in original_handlers:
                    root_logger.addHandler(handler)
                root_logger.setLevel(original_level)

                # Restore phenex logger configuration
                phenex_logger.handlers.clear()
                for handler in phenex_original_handlers:
                    phenex_logger.addHandler(handler)
                phenex_logger.setLevel(phenex_original_level)

                # Restore app logger configuration
                app_logger.handlers.clear()
                for handler in app_original_handlers:
                    app_logger.addHandler(handler)
                app_logger.setLevel(app_original_level)

                output_queue.put("__EXECUTION_COMPLETE__")

        # Start execution in a separate thread
        execution_thread = threading.Thread(target=capture_output)
        execution_thread.start()

        # Stream output as it comes
        while True:
            try:
                # Check for output with a timeout
                if not output_queue.empty():
                    output = output_queue.get_nowait()
                    if output == "__EXECUTION_COMPLETE__":
                        break
                    yield f"data: {json.dumps({'type': 'log', 'message': output})}\n\n"
                else:
                    await asyncio.sleep(0.1)  # Small delay to prevent busy waiting
            except Exception:
                await asyncio.sleep(0.1)

        # Wait for thread to complete
        execution_thread.join()

        # Send final result
        if "error" in final_result:
            yield f"data: {json.dumps({'type': 'error', 'message': final_result['error']})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'result', 'data': final_result})}\n\n"

        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

    return StreamingResponse(
        stream_execution(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        },
    )


def convert_structured_to_phenotypes(cohort_dict: Dict) -> Dict:
    """
    Converts a cohort from structured format back to phenotypes-only format.

    Takes a cohort with separate entry_criterion, inclusions, exclusions, characteristics,
    and outcomes keys and combines them into a single 'phenotypes' array with type fields.

    This is the reverse operation of the conversion done in prepare_cohort_for_phenex.
    Used to return execution results to the frontend in the expected format.

    Args:
        cohort_dict: Cohort in structured format with entry_criterion, inclusions, etc.

    Returns:
        Dict: Cohort with all phenotypes in a single 'phenotypes' array
    """
    import copy

    result = copy.deepcopy(cohort_dict)
    phenotypes = []

    # Add entry criterion
    if "entry_criterion" in result:
        entry = result["entry_criterion"]
        if entry:
            # Ensure it has type field
            if "type" not in entry:
                entry["type"] = "entry"
            phenotypes.append(entry)
        del result["entry_criterion"]

    # Add inclusions
    if "inclusions" in result:
        for inclusion in result["inclusions"]:
            # Ensure it has type field
            if "type" not in inclusion:
                inclusion["type"] = "inclusion"
            phenotypes.append(inclusion)
        del result["inclusions"]

    # Add exclusions
    if "exclusions" in result:
        for exclusion in result["exclusions"]:
            # Ensure it has type field
            if "type" not in exclusion:
                exclusion["type"] = "exclusion"
            phenotypes.append(exclusion)
        del result["exclusions"]

    # Add characteristics
    if "characteristics" in result:
        for characteristic in result["characteristics"]:
            # Ensure it has type field
            if "type" not in characteristic:
                characteristic["type"] = "baseline"
            phenotypes.append(characteristic)
        del result["characteristics"]

    # Add outcomes
    if "outcomes" in result:
        for outcome in result["outcomes"]:
            # Ensure it has type field
            if "type" not in outcome:
                outcome["type"] = "outcome"
            phenotypes.append(outcome)
        del result["outcomes"]

    # Set the phenotypes array
    result["phenotypes"] = phenotypes

    logger.info(
        f"Converted cohort from structured format to phenotypes array with {len(phenotypes)} phenotypes"
    )

    return result


def append_count_to_cohort(phenex_cohort, cohort_dict):
    cohort_dict["entry_criterion"]["count"] = append_count_to_phenotype(
        phenex_cohort.entry_criterion, cohort_dict["entry_criterion"]
    )
    if isinstance(phenex_cohort.inclusions, list) and len(phenex_cohort.inclusions) > 0:
        append_count_to_phenotypes(phenex_cohort.inclusions, cohort_dict["inclusions"])
    if isinstance(phenex_cohort.exclusions, list) and len(phenex_cohort.exclusions) > 0:
        append_count_to_phenotypes(phenex_cohort.exclusions, cohort_dict["exclusions"])
    if (
        isinstance(phenex_cohort.characteristics, list)
        and len(phenex_cohort.characteristics) > 0
    ):
        append_count_to_phenotypes(
            phenex_cohort.characteristics, cohort_dict["characteristics"]
        )
    if isinstance(phenex_cohort.outcomes, list) and len(phenex_cohort.outcomes) > 0:
        append_count_to_phenotypes(phenex_cohort.outcomes, cohort_dict["outcomes"])


def append_count_to_phenotype(phenex_phenotype, phenotype_dict):
    """
    Recursively appends count to a phenotype and all its nested child phenotypes.

    For LogicPhenotypes with ComputationGraph expressions, this function traverses
    the entire tree structure and appends counts to all embedded component phenotypes.

    Args:
        phenex_phenotype: The executed PhenEx phenotype object with count information
        phenotype_dict: The dictionary representation of the phenotype to update
    """
    # Append count to the current phenotype
    if hasattr(phenex_phenotype, "count"):
        phenotype_dict["count"] = phenex_phenotype.count

    # If this is a LogicPhenotype with a ComputationGraph expression, recursively process nested phenotypes
    if (
        hasattr(phenex_phenotype, "expression")
        and phenex_phenotype.expression is not None
    ):
        phenex_expression = phenex_phenotype.expression

        # The phenotype_dict should also have an expression field (ComputationGraph)
        if "expression" in phenotype_dict and phenotype_dict["expression"] is not None:
            dict_expression = phenotype_dict["expression"]
            _append_count_to_computation_graph(phenex_expression, dict_expression)


def _append_count_to_computation_graph(phenex_node, dict_node):
    """
    Helper function to recursively traverse a ComputationGraph and append counts to all nodes.

    Args:
        phenex_node: The executed PhenEx ComputationGraph node or phenotype
        dict_node: The dictionary representation of the node to update
    """
    # Check if this is a ComputationGraph node (has left and right children)
    if hasattr(phenex_node, "left") and hasattr(phenex_node, "right"):
        # Recursively process left and right branches
        if "left" in dict_node:
            _append_count_to_computation_graph(phenex_node.left, dict_node["left"])
        if "right" in dict_node:
            _append_count_to_computation_graph(phenex_node.right, dict_node["right"])
    else:
        # This is a leaf node (actual phenotype) - append its count
        if hasattr(phenex_node, "count"):
            dict_node["count"] = phenex_node.count

        # If this leaf phenotype is itself a LogicPhenotype, recursively process its expression
        if hasattr(phenex_node, "expression") and phenex_node.expression is not None:
            if "expression" in dict_node and dict_node["expression"] is not None:
                _append_count_to_computation_graph(
                    phenex_node.expression, dict_node["expression"]
                )


def append_count_to_phenotypes(phenex_phenotypes, list_of_phenotype_dicts):
    """
    Appends counts to a list of phenotypes and all their nested child phenotypes.

    Args:
        phenex_phenotypes: List of executed PhenEx phenotype objects
        list_of_phenotype_dicts: List of phenotype dictionaries to update
    """
    for phenex_phenotype, phenotype_dict in zip(
        phenex_phenotypes, list_of_phenotype_dicts
    ):
        append_count_to_phenotype(phenex_phenotype, phenotype_dict)


# -- EXECUTION CODELIST MANAGEMENT --
# TODO import to codelist_file_management.py


def resolve_phenexui_codelist_file(phenexui_codelist, user_id):
    """
    Resolves a phenexui codelist file to a codelist object dict representation. PhenEx UI codelists of file type do not contain actual codes, rather only the name of the codelist file, a mapping of codelist columns, and the name of codelist to extract.
    Args:
        phenexui_codelist: The phenexui codelist representation.
        user_id (str): The authenticated user ID.
    Returns:
        dict: The resolved PhenEx Codelist object dict representation with codes and code_type.
    """
    # For execution time, create a sync wrapper around the async function
    import asyncio

    # Handle both old format (top-level keys) and new format (nested in codelist object)
    # New format: {"class_name": "Codelist", "codelist": {"file_id": "...", "file_name": "...", "codelist_name": "..."}, "codelist_type": "from file"}
    # Old format: {"file_id": "...", "codelist_name": "...", "codelist_type": "from_file", ...}
    codelist_obj = phenexui_codelist.get("codelist", {})
    file_id = (
        codelist_obj.get("file_id")
        or phenexui_codelist.get("codelist_id")
        or phenexui_codelist.get("file_id", "Unknown")
    )
    cohort_id = phenexui_codelist.get("cohort_id", "Unknown")
    codelist_name = codelist_obj.get("codelist_name") or phenexui_codelist.get(
        "codelist_name", "Unknown"
    )

    print(
        f"📄 INSIDE resolve_phenexui_codelist_file - Resolving codelist file '{file_id}' for codelist '{codelist_name}' in cohort '{cohort_id}' for user {user_id}"
    )
    logger.info(
        f"📄 Resolving codelist file '{file_id}' for codelist '{codelist_name}' in cohort '{cohort_id}'"
    )

    async def _resolve_codelist_file():
        if not user_id:
            raise ValueError(f"user_id is required for codelist resolution")

        print(
            f"📄 INSIDE _resolve_codelist_file - Fetching codelist file '{file_id}' for user '{user_id}'"
        )
        logger.info(f"📄 Fetching codelist file '{file_id}' for user '{user_id}'")
        # Get the codelist file (handle both old and new formats)
        codelist_obj = phenexui_codelist.get("codelist", {})
        actual_file_id = (
            codelist_obj.get("file_id")
            or phenexui_codelist.get("codelist_id")
            or phenexui_codelist.get("file_id")
        )
        actual_cohort_id = phenexui_codelist.get("cohort_id")
        if not actual_file_id or not actual_cohort_id:
            raise ValueError(
                f"Missing required file_id or cohort_id in codelist: {phenexui_codelist}"
            )
        codelist_file = await get_codelist_file_for_cohort(
            db_manager, actual_cohort_id, actual_file_id, user_id
        )

        if codelist_file:
            print(
                f"📄 INSIDE _resolve_codelist_file - Successfully retrieved codelist file '{file_id}': {codelist_file.get('filename', 'No filename')}"
            )
            logger.info(
                f"📄 Successfully retrieved codelist file '{file_id}': {codelist_file.get('filename', 'No filename')}"
            )
        else:
            print(
                f"📄 INSIDE _resolve_codelist_file - Failed to retrieve codelist file '{file_id}'"
            )
            logger.error(f"📄 Failed to retrieve codelist file '{file_id}'")

        return codelist_file

    try:
        # Try to get the current event loop, if it doesn't exist create a new one
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            # No event loop in current thread, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        codelist_file = loop.run_until_complete(_resolve_codelist_file())

        if not codelist_file:
            raise ValueError(f"Codelist file {phenexui_codelist['file_id']} not found")

    except Exception as e:
        logger.error(f"Failed to resolve codelist file during execution: {e}")
        raise ValueError(
            f"Could not resolve codelist file {phenexui_codelist['file_id']} for execution"
        )

    # variables phenexui codelist components (for ease of reading...)
    # Handle both old format (top-level) and new format (nested in codelist object)
    codelist_obj = phenexui_codelist.get("codelist", {})
    code_column = codelist_obj.get("code_column") or phenexui_codelist.get(
        "code_column", "code"
    )
    code_type_column = codelist_obj.get("code_type_column") or phenexui_codelist.get(
        "code_type_column", "code_type"
    )
    codelist_column = codelist_obj.get("codelist_column") or phenexui_codelist.get(
        "codelist_column", "codelist"
    )
    data = codelist_file["contents"]["data"]

    print(
        f"📄 INSIDE resolve_phenexui_codelist_file - File data structure - columns: {list(data.keys())}"
    )
    print(
        f"📄 INSIDE resolve_phenexui_codelist_file - Looking for codes in column '{code_column}', code_types in '{code_type_column}', codelist names in '{codelist_column}'"
    )
    print(
        f"📄 INSIDE resolve_phenexui_codelist_file - Total rows in file: {len(data.get(code_column, []))}"
    )
    print(
        f"📄 INSIDE resolve_phenexui_codelist_file - Target codelist name: '{codelist_name}'"
    )
    logger.info(f"📄 File data structure - columns: {list(data.keys())}")
    logger.info(
        f"📄 Looking for codes in column '{code_column}', code_types in '{code_type_column}', codelist names in '{codelist_column}'"
    )
    logger.info(f"📄 Total rows in file: {len(data.get(code_column, []))}")
    logger.info(f"📄 Target codelist name: '{codelist_name}'")

    # Check if the required columns exist
    if code_column not in data:
        logger.error(f"📄 Code column '{code_column}' not found in file data")
        raise ValueError(f"Code column '{code_column}' not found in file")
    if code_type_column not in data:
        logger.error(f"📄 Code type column '{code_type_column}' not found in file data")
        raise ValueError(f"Code type column '{code_type_column}' not found in file")
    if codelist_column not in data:
        logger.error(f"📄 Codelist column '{codelist_column}' not found in file data")
        raise ValueError(f"Codelist column '{codelist_column}' not found in file")

    # Check what codelist names are available
    unique_codelists = set(data[codelist_column])
    print(
        f"📄 INSIDE resolve_phenexui_codelist_file - Available codelist names in file: {sorted(unique_codelists)}"
    )
    logger.info(f"📄 Available codelist names in file: {sorted(unique_codelists)}")

    if codelist_name not in unique_codelists:
        print(
            f"📄 INSIDE resolve_phenexui_codelist_file - WARNING: Target codelist '{codelist_name}' not found in available codelists: {sorted(unique_codelists)}"
        )
        logger.warning(
            f"📄 Target codelist '{codelist_name}' not found in available codelists: {sorted(unique_codelists)}"
        )
    else:
        print(
            f"📄 INSIDE resolve_phenexui_codelist_file - Target codelist '{codelist_name}' found in file"
        )
        logger.info(f"📄 Target codelist '{codelist_name}' found in file")

    # data are three parallel lists of code, code_type, codelist_name
    # get all codes/code_type for codelist_name
    codes_and_code_type = [
        [code, code_type]
        for code, code_type, codelist in zip(
            data[code_column], data[code_type_column], data[codelist_column]
        )
        if codelist == phenexui_codelist["codelist_name"]
    ]

    print(
        f"📄 INSIDE resolve_phenexui_codelist_file - Found {len(codes_and_code_type)} matching codes for codelist '{codelist_name}'"
    )
    logger.info(
        f"📄 Found {len(codes_and_code_type)} matching codes for codelist '{codelist_name}'"
    )

    # convert into phenex codelist representation {code_type:[codes...]}
    phenex_codelist = {}
    for [code, code_type] in codes_and_code_type:
        if code_type not in phenex_codelist.keys():
            phenex_codelist[code_type] = []
        phenex_codelist[code_type].append(code)

    # Log summary of code types and counts (but don't print the actual codes)
    for code_type, codes in phenex_codelist.items():
        print(
            f"📄 INSIDE resolve_phenexui_codelist_file - Code type '{code_type}': {len(codes)} codes"
        )
        logger.info(f"📄 Code type '{code_type}': {len(codes)} codes")

    print(
        f"📄 INSIDE resolve_phenexui_codelist_file - Successfully resolved codelist '{codelist_name}' with {sum(len(codes) for codes in phenex_codelist.values())} total codes across {len(phenex_codelist)} code types"
    )
    logger.info(
        f"📄 Successfully resolved codelist '{codelist_name}' with {sum(len(codes) for codes in phenex_codelist.values())} total codes across {len(phenex_codelist)} code types"
    )

    # return phenex Codelist representation
    return {
        "class_name": "Codelist",
        "name": phenexui_codelist["codelist_name"],
        "codelist": phenex_codelist,
        "use_code_type": False,
    }


def resolve_medconb_codelist(phenexui_codelist):
    """
    Get Codelists from MedConB codelist files
    """
    return phenexui_codelist


def prepare_codelist_for_phenex(phenexui_codelist, user_id):
    """
    Prepares a single codelist from PhenEx UI for PhenEx execution by resolving codelists if necessary.
    Args:
        phenexui_codelist: A dictionary representing a codelist in the PhenEx UI.
        user_id (str): The authenticated user ID.
    Returns:
        A dictionary representing PhenEx codelist with codes resolved
    """
    codelist_type = phenexui_codelist.get("codelist_type")
    codelist_name = phenexui_codelist.get("name", "Unknown")
    print(
        f"📋 INSIDE prepare_codelist_for_phenex - Preparing codelist '{codelist_name}' of type: {codelist_type} for user {user_id}"
    )
    logger.info(f"📋 Preparing codelist '{codelist_name}' of type: {codelist_type}")

    if codelist_type is None:
        print(
            f"📋 INSIDE prepare_codelist_for_phenex - Codelist '{codelist_name}' has no type, returning as-is"
        )
        logger.info(f"📋 Codelist '{codelist_name}' has no type, returning as-is")
        return phenexui_codelist
    if codelist_type == "manual":
        codes_count = len(phenexui_codelist.get("codelist", {}).get("codes", []))
        print(
            f"📋 INSIDE prepare_codelist_for_phenex - Manual codelist '{codelist_name}' has {codes_count} codes"
        )
        logger.info(f"📋 Manual codelist '{codelist_name}' has {codes_count} codes")
        return phenexui_codelist
    elif codelist_type == "from file" or codelist_type == "from_file":
        print(
            f"📋 INSIDE prepare_codelist_for_phenex - Resolving file-based codelist '{codelist_name}' for user {user_id}"
        )
        logger.info(
            f"📋 Resolving file-based codelist '{codelist_name}' for user {user_id}"
        )
        resolved = resolve_phenexui_codelist_file(phenexui_codelist, user_id)
        codes_count = sum(len(codes) for codes in resolved.get("codelist", {}).values())
        print(
            f"📋 INSIDE prepare_codelist_for_phenex - File-based codelist '{codelist_name}' resolved with {codes_count} codes"
        )
        logger.info(
            f"📋 File-based codelist '{codelist_name}' resolved with {codes_count} codes"
        )
        logger.info(
            f"📋 File-based codelist '{codelist_name}' resolved with {codes_count} total codes"
        )
        return resolved
    elif codelist_type == "from medconb":
        print(
            f"📋 INSIDE prepare_codelist_for_phenex - Using MedConB codelist '{codelist_name}'"
        )
        logger.info(f"📋 Using MedConB codelist '{codelist_name}'")
        return resolve_medconb_codelist(phenexui_codelist)

    print(
        f"📋 INSIDE prepare_codelist_for_phenex - ERROR: Unknown codelist class: {phenexui_codelist['class_name']}"
    )
    raise ValueError(f"Unknown codelist class: {phenexui_codelist['class_name']}")


def prepare_phenotypes_for_phenex(phenotypes: list[dict], user_id):
    """
    Iterates over a list of phenotypes and prepares the codelist of each one for phenex.

    Args:
        phenotypes : List of phenotypes from PhenEx UI with codelists of various types
        user_id (str): The authenticated user ID.
    Returns:
        List of phenotypes with codelists prepared for phenex
    """
    print(
        f"🧬 INSIDE prepare_phenotypes_for_phenex - Preparing {len(phenotypes)} phenotypes for user {user_id}"
    )
    logger.info(f"🧬 Preparing {len(phenotypes)} phenotypes for user {user_id}")

    # iterate over each phenotype
    for i, phenotype in enumerate(phenotypes):
        phenotype_name = phenotype.get("name", f"Phenotype_{i}")
        phenotype_class = phenotype.get("class_name", "Unknown")
        print(
            f"🧬 INSIDE prepare_phenotypes_for_phenex - Processing phenotype '{phenotype_name}' ({phenotype_class})"
        )
        logger.info(f"🧬 Processing phenotype '{phenotype_name}' ({phenotype_class})")

        # if it contains a codelist, prepare it for phenex
        if phenotype["class_name"] in ["CodelistPhenotype", "MeasurementPhenotype"]:
            print(
                f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' has codelist, preparing..."
            )
            phenotype = prepare_codelists_for_phenotype(phenotype, user_id)
            print(
                f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' codelist preparation completed"
            )
        elif phenotype["class_name"] == "TimeRangePhenotype":
            print(
                f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' is TimeRangePhenotype, preparing..."
            )
            phenotype = prepare_time_range_phenotype(phenotype)
            print(
                f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' TimeRange preparation completed"
            )
        elif phenotype["class_name"] == "LogicPhenotype":
            print(
                f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' is LogicPhenotype, preparing expression..."
            )
            phenotype = prepare_logic_phenotype_expression(phenotype, user_id)
            print(
                f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' LogicPhenotype preparation completed"
            )
        else:
            print(
                f"🧬 INSIDE prepare_phenotypes_for_phenex - Phenotype '{phenotype_name}' requires no preparation"
            )

    print(
        f"🧬 INSIDE prepare_phenotypes_for_phenex - Completed preparing {len(phenotypes)} phenotypes"
    )
    logger.info(f"🧬 Completed preparing {len(phenotypes)} phenotypes")
    return phenotypes


def prepare_codelists_for_phenotype(phenotype: dict, user_id):
    """
    Iterates over a list of phenotypes and prepares the codelist of each one for phenex.

    Args:
        phenotype: A phenotype from PhenEx UI with codelists of various types
        user_id (str): The authenticated user ID.
    Returns:
        Phenotype with codelists prepared for phenex
    """
    phenotype_name = phenotype.get("name", "Unknown")
    print(
        f"📋 INSIDE prepare_codelists_for_phenotype - Preparing codelists for phenotype '{phenotype_name}' with user {user_id}"
    )
    logger.info(f"Preparing codelists for phenotype '{phenotype_name}'")
    # if it is a list, create a composite codelist
    if isinstance(phenotype["codelist"], list):
        print(
            f"🧬 INSIDE prepare_codelists_for_phenotype - Phenotype '{phenotype_name}' has {len(phenotype['codelist'])} codelists to prepare"
        )
        logger.info(
            f"🧬 Phenotype '{phenotype_name}' has {len(phenotype['codelist'])} codelists to prepare"
        )
        codelist = [
            prepare_codelist_for_phenex(x, user_id) for x in phenotype["codelist"]
        ]
        composite_codelist = {
            "class_name": "CompositeCodelist",
            "codelists": codelist,
        }
        phenotype["codelist"] = composite_codelist
        print(
            f"🧬 INSIDE prepare_codelists_for_phenotype - Created CompositeCodelist for phenotype '{phenotype_name}'"
        )
        logger.info(f"🧬 Created CompositeCodelist for phenotype '{phenotype_name}'")
    else:
        print(
            f"🧬 INSIDE prepare_codelists_for_phenotype - Phenotype '{phenotype_name}' has single codelist to prepare"
        )
        logger.info(f"🧬 Phenotype '{phenotype_name}' has single codelist to prepare")
        phenotype["codelist"] = prepare_codelist_for_phenex(
            phenotype["codelist"], user_id
        )
        print(
            f"🧬 INSIDE prepare_codelists_for_phenotype - Single codelist prepared for phenotype '{phenotype_name}'"
        )

    print(
        f"🧬 INSIDE prepare_codelists_for_phenotype - COMPLETED phenotype '{phenotype_name}' codelist preparation"
    )
    return phenotype


def prepare_time_range_phenotype(phenotype: dict):
    if (
        "relative_time_range" in phenotype.keys()
        and phenotype["relative_time_range"] is not None
    ):
        if isinstance(phenotype["relative_time_range"], list):
            phenotype["relative_time_range"] = phenotype["relative_time_range"][0]
    return phenotype


def prepare_logic_phenotype_expression(phenotype: dict, user_id: str):
    """
    Prepares a LogicPhenotype by recursively processing its ComputationGraph expression.
    The frontend already sends the correct ComputationGraph structure, so we just need
    to recursively prepare any nested phenotypes (codelists, etc.).

    Args:
        phenotype: The LogicPhenotype dictionary with ComputationGraph expression
        user_id: The authenticated user ID

    Returns:
        The phenotype with all nested phenotypes prepared
    """
    if phenotype.get("class_name") != "LogicPhenotype":
        return phenotype

    expression = phenotype.get("expression")
    if not expression:
        logger.warning(f"LogicPhenotype '{phenotype.get('name')}' missing expression")
        return phenotype

    print(
        f"🧬 Recursively preparing ComputationGraph expression for '{phenotype.get('name')}'"
    )
    logger.info(
        f"🧬 Recursively preparing ComputationGraph expression for '{phenotype.get('name')}'"
    )

    # Recursively prepare the expression tree
    phenotype["expression"] = prepare_computation_graph_node(expression, user_id)

    return phenotype


def prepare_computation_graph_node(node: dict, user_id: str):
    """
    Recursively processes a ComputationGraph node and prepares nested phenotypes.

    Args:
        node: A node in the ComputationGraph (either a ComputationGraph or a phenotype)
        user_id: The authenticated user ID

    Returns:
        The prepared node
    """
    if node.get("class_name") == "ComputationGraph":
        # This is a binary operator node - recursively process left and right
        print(
            f"🧬 Processing ComputationGraph node with operator '{node.get('operator')}'"
        )

        node["left"] = prepare_computation_graph_node(node["left"], user_id)
        node["right"] = prepare_computation_graph_node(node["right"], user_id)

        return node
    else:
        # This is a leaf node (an actual phenotype) - prepare it
        phenotype_class = node.get("class_name", "Unknown")
        phenotype_name = node.get("name", "Unknown")

        print(f"🧬 Preparing leaf phenotype '{phenotype_name}' ({phenotype_class})")

        if phenotype_class in ["CodelistPhenotype", "MeasurementPhenotype"]:
            node = prepare_codelists_for_phenotype(node, user_id)
        elif phenotype_class == "TimeRangePhenotype":
            node = prepare_time_range_phenotype(node)
        elif phenotype_class == "LogicPhenotype":
            # Nested LogicPhenotype - recursively prepare it
            node = prepare_logic_phenotype_expression(node, user_id)

        return node


def prepare_cohort_for_phenex(phenexui_cohort: dict, user_id):
    """
    Prepares a cohort from PhenEx UI for PhenEx library execution.

    This function performs two main tasks:
    1. Converts phenotypes-only format to structured format (entry_criterion, inclusions, etc.)
       required by PhenEx library
    2. Resolves codelists (manual, from file, from medconb) to actual code lists

    The UI sends cohorts in phenotypes-only format with a single 'phenotypes' array where each
    phenotype has a 'type' field. The PhenEx library expects the structured format with separate
    keys for entry_criterion, inclusions, exclusions, characteristics, and outcomes.

    Args:
        phenexui_cohort: The cohort dictionary from PhenExUI with phenotypes array
        user_id (str): The authenticated user ID for codelist file resolution

    Returns:
        dict: The cohort dictionary in PhenEx library format with:
            - entry_criterion: Single phenotype object
            - inclusions: List of phenotypes
            - exclusions: List of phenotypes
            - characteristics: List of phenotypes
            - outcomes: List of phenotypes
            - All codelists resolved with actual codes
    """
    import copy

    cohort_name = phenexui_cohort.get("name", "Unknown")
    print(
        f"🏥 INSIDE prepare_cohort_for_phenex - Starting cohort preparation for '{cohort_name}' (user: {user_id})"
    )
    logger.info(f"🏥 Starting cohort preparation for '{cohort_name}' (user: {user_id})")

    phenex_cohort = copy.deepcopy(phenexui_cohort)

    # Convert phenotypes-only format to structured format for PhenEx library
    if "phenotypes" in phenex_cohort:
        logger.info(
            f"🏥 Converting {len(phenex_cohort['phenotypes'])} phenotypes from array format to structured format"
        )

        phenotypes = phenex_cohort["phenotypes"]

        # Split phenotypes by type
        entry_phenotypes = [p for p in phenotypes if p.get("type") == "entry"]
        inclusion_phenotypes = [p for p in phenotypes if p.get("type") == "inclusion"]
        exclusion_phenotypes = [p for p in phenotypes if p.get("type") == "exclusion"]
        baseline_phenotypes = [p for p in phenotypes if p.get("type") == "baseline"]
        outcome_phenotypes = [p for p in phenotypes if p.get("type") == "outcome"]

        # Set entry_criterion (should be exactly one)
        if entry_phenotypes:
            phenex_cohort["entry_criterion"] = entry_phenotypes[0]
            logger.info(
                f"🏥 Set entry_criterion: {entry_phenotypes[0].get('name', 'Unnamed')}"
            )
        else:
            logger.warning(f"🏥 No entry phenotype found in cohort '{cohort_name}'")

        # Set other categories
        if inclusion_phenotypes:
            phenex_cohort["inclusions"] = inclusion_phenotypes
            logger.info(f"🏥 Set {len(inclusion_phenotypes)} inclusions")

        if exclusion_phenotypes:
            phenex_cohort["exclusions"] = exclusion_phenotypes
            logger.info(f"🏥 Set {len(exclusion_phenotypes)} exclusions")

        if baseline_phenotypes:
            phenex_cohort["characteristics"] = baseline_phenotypes
            logger.info(f"🏥 Set {len(baseline_phenotypes)} characteristics")

        if outcome_phenotypes:
            phenex_cohort["outcomes"] = outcome_phenotypes
            logger.info(f"🏥 Set {len(outcome_phenotypes)} outcomes")

        # Remove the phenotypes array as it's no longer needed
        del phenex_cohort["phenotypes"]
        logger.info(f"🏥 Removed phenotypes array after conversion")

    # Now prepare codelists for each category
    if "entry_criterion" in phenex_cohort:
        logger.info(
            f"🏥 Preparing entry criterion codelists for cohort '{cohort_name}'"
        )
        phenex_cohort["entry_criterion"] = prepare_phenotypes_for_phenex(
            [phenex_cohort["entry_criterion"]], user_id
        )[0]

    if "inclusions" in phenex_cohort:
        logger.info(
            f"🏥 Preparing codelists for {len(phenex_cohort['inclusions'])} inclusions"
        )
        phenex_cohort["inclusions"] = prepare_phenotypes_for_phenex(
            phenex_cohort["inclusions"], user_id
        )

    if "exclusions" in phenex_cohort:
        logger.info(
            f"🏥 Preparing codelists for {len(phenex_cohort['exclusions'])} exclusions"
        )
        phenex_cohort["exclusions"] = prepare_phenotypes_for_phenex(
            phenex_cohort["exclusions"], user_id
        )

    if "characteristics" in phenex_cohort:
        logger.info(
            f"🏥 Preparing codelists for {len(phenex_cohort['characteristics'])} characteristics"
        )
        phenex_cohort["characteristics"] = prepare_phenotypes_for_phenex(
            phenex_cohort["characteristics"], user_id
        )

    if "outcomes" in phenex_cohort:
        logger.info(
            f"🏥 Preparing codelists for {len(phenex_cohort['outcomes'])} outcomes"
        )
        phenex_cohort["outcomes"] = prepare_phenotypes_for_phenex(
            phenex_cohort["outcomes"], user_id
        )

    logger.info(f"🏥 Completed cohort preparation for '{cohort_name}'")
    return phenex_cohort
