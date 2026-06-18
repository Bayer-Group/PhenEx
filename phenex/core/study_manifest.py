"""Study execution manifest and checkpoint loading."""
from __future__ import annotations

import datetime
import glob
import json
import os
import sys
from typing import TYPE_CHECKING, Callable, Dict, List, Optional

if TYPE_CHECKING:
    from phenex.core.study import Study

MANIFEST_VERSION = "1.0"

def _legacy_info_txt_path(study_path) -> str:
    return os.path.join(os.fspath(study_path), "info.txt")


def _parse_legacy_info_txt(study_path) -> Dict[str, str]:
    info_path = _legacy_info_txt_path(study_path)
    if not os.path.isfile(info_path):
        return {}
    result: Dict[str, str] = {}
    with open(info_path) as f:
        for line in f:
            if ":" in line and not line.startswith("="):
                key, _, value = line.partition(":")
                key, value = key.strip(), value.strip()
                if key and value:
                    result[key] = value
    return result


def read_manifest(study_path) -> Optional[Dict]:
    manifest_path = os.path.join(os.fspath(study_path), "manifest.json")
    if not os.path.isfile(manifest_path):
        return None
    with open(manifest_path) as f:
        return json.load(f)


def read_phenex_version(study_path) -> str:
    manifest = read_manifest(study_path)
    if manifest:
        version = (manifest.get("environment") or {}).get("phenex_version")
        if version:
            return version
    legacy = _parse_legacy_info_txt(study_path)
    version = legacy.get("PhenEx Version")
    if version:
        return version
    return environment_info()["phenex_version"]


def read_study_name(study_path) -> Optional[str]:
    manifest = read_manifest(study_path)
    if manifest:
        name = manifest.get("study_name")
        if name:
            return name
    legacy = _parse_legacy_info_txt(study_path)
    return legacy.get("Study Name")


def execution_info_dict(study_path) -> Dict[str, str]:
    manifest = read_manifest(study_path)
    if manifest:
        result: Dict[str, str] = {}
        study_name = manifest.get("study_name")
        if study_name:
            result["Study Name"] = study_name
        env = manifest.get("environment") or {}
        phenex_version = env.get("phenex_version")
        if phenex_version:
            result["PhenEx Version"] = phenex_version
        python_version = env.get("python_version")
        if python_version:
            result["Python Version"] = python_version
        execution = manifest.get("execution") or {}
        started = execution.get("started_at") or execution.get("completed_at")
        if started:
            try:
                normalized = started.replace("Z", "+00:00")
                dt = datetime.datetime.fromisoformat(normalized)
                if dt.tzinfo is not None:
                    dt = dt.astimezone().replace(tzinfo=None)
                result["Study Execution Date"] = dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                result["Study Execution Date"] = started
        return result
    return _parse_legacy_info_txt(study_path)




def _utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def environment_info() -> Dict[str, str]:
    from phenex import __version__ as phenex_version

    return {
        "python_version": sys.version,
        "phenex_version": phenex_version,
    }


def cohort_manifest_entry(
    cohort,
    directory: str,
    files_written: List[str],
    *,
    reused_from: Optional[str],
) -> Dict:
    frozen_json = os.path.join(directory, f"frozen_{cohort.name}.json")
    entry = {
        "name": cohort.name,
        "class_name": cohort.__class__.__name__,
        "directory": directory,
        "frozen_json": frozen_json,
        "files_written": sorted(files_written),
    }
    if reused_from:
        entry["reused_from"] = reused_from
    return entry


def collect_study_level_files(execution_dir: str, track_fn: Callable[[str, Optional[str]], None]) -> None:
    for pattern in ("results_*.xlsx", "*.html"):
        for fpath in glob.glob(os.path.join(execution_dir, pattern)):
            role = "study_results" if fpath.endswith(".xlsx") else "study_html"
            track_fn(fpath, role)


def build_manifest(
    study: "Study",
    *,
    timestamp_dir: str,
    started_at: str,
    completed_at: str,
    exit_state: str,
    error_message: Optional[str],
    execution_parameters: Dict,
    cohorts: List[Dict],
    files: List[Dict],
) -> Dict:
    execution = {
        "timestamp_dir": timestamp_dir,
        "started_at": started_at,
        "completed_at": completed_at,
        "exit_state": exit_state,
    }
    if error_message:
        execution["error"] = error_message
    return {
        "manifest_version": MANIFEST_VERSION,
        "class_name": study.__class__.__name__,
        "study_name": study.name,
        "description": study.description,
        "study_path": study.path,
        "execution": execution,
        "environment": environment_info(),
        "execution_parameters": execution_parameters,
        "cohorts": cohorts,
        "files": files,
    }


def run_study_execute(
    study: "Study",
    overwrite: Optional[bool] = False,
    n_threads: Optional[int] = 1,
    lazy_execution: Optional[bool] = False,
    previous_executions: Optional[Dict[str, str]] = None,
) -> None:
    path_exec_dir_study = study._prepare_study_execution_directory()
    timestamp_dir = os.path.basename(path_exec_dir_study)
    started_at = _utc_now_iso()
    error_message = None
    exit_state = "Fail"

    exec_params = {
        "overwrite": overwrite,
        "n_threads": n_threads,
        "lazy_execution": lazy_execution,
        "previous_executions": previous_executions or {},
    }
    cohort_records: List[Dict] = []
    file_entries: List[Dict] = []
    seen_files = set()

    def _rel(path: str) -> str:
        return os.path.relpath(path, path_exec_dir_study)

    def _track(abs_path: str, role: Optional[str] = None) -> None:
        rel = _rel(abs_path)
        if rel in seen_files:
            return
        seen_files.add(rel)
        entry: Dict = {"path": rel}
        if role:
            entry["role"] = role
        file_entries.append(entry)

    try:
        study.custom_reporters = study.custom_reporters or []
        previous_executions = previous_executions or {}
        parents_requiring_execution = study._get_parents_requiring_execution(
            previous_executions
        )

        for _cohort in study.cohorts:
            path_exec_dir_cohort = study._prepare_cohort_execution_directory(
                _cohort, path_exec_dir_study
            )
            cohort_rel_dir = _rel(path_exec_dir_cohort)
            cohort_files: List[str] = []
            reused_from = None

            def _track_cohort_file(abs_path: str) -> None:
                rel = _rel(abs_path)
                if rel not in cohort_files:
                    cohort_files.append(rel)
                _track(abs_path)

            if study._should_use_previous_execution(
                _cohort, previous_executions, parents_requiring_execution
            ):
                if study._copy_previous_execution(
                    _cohort, previous_executions[_cohort.name], path_exec_dir_cohort
                ):
                    reused_from = previous_executions[_cohort.name]
                    for item in os.listdir(path_exec_dir_cohort):
                        item_path = os.path.join(path_exec_dir_cohort, item)
                        if os.path.isfile(item_path):
                            _track_cohort_file(item_path)
                    cohort_records.append(
                        cohort_manifest_entry(
                            _cohort,
                            cohort_rel_dir,
                            cohort_files,
                            reused_from=reused_from,
                        )
                    )
                    continue

            frozen_path = study._save_serialized_cohort(_cohort, path_exec_dir_cohort)
            _track_cohort_file(frozen_path)

            _original_custom_reporters = _cohort.custom_reporters
            _cohort.custom_reporters = (
                _original_custom_reporters or []
            ) + study.custom_reporters

            _cohort.execute(
                overwrite=overwrite,
                lazy_execution=lazy_execution,
                n_threads=n_threads,
            )

            _cohort.custom_reporters = _original_custom_reporters

            _cohort.write_reports_to_json(path_exec_dir_cohort)
            _cohort.write_reports_to_html(path_exec_dir_cohort)

            for item in os.listdir(path_exec_dir_cohort):
                item_path = os.path.join(path_exec_dir_cohort, item)
                if os.path.isfile(item_path):
                    _track_cohort_file(item_path)

            cohort_records.append(
                cohort_manifest_entry(
                    _cohort, cohort_rel_dir, cohort_files, reused_from=None
                )
            )

        study._concatenate_reports(path_exec_dir_study)
        collect_study_level_files(path_exec_dir_study, _track)

        exit_state = "Success"
    except Exception as exc:
        error_message = str(exc)
        raise
    finally:
        completed_at = _utc_now_iso()
        manifest = build_manifest(
            study,
            timestamp_dir=timestamp_dir,
            started_at=started_at,
            completed_at=completed_at,
            exit_state=exit_state,
            error_message=error_message,
            execution_parameters=exec_params,
            cohorts=cohort_records,
            files=file_entries,
        )
        manifest_path = os.path.join(path_exec_dir_study, "manifest.json")
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2, default=str)
        _track(manifest_path, "manifest")
        manifest["files"] = file_entries

        study.execution_path = path_exec_dir_study
        study.exit_state = exit_state
        study.manifest = manifest




def _ensure_checkpoint_deserializers() -> None:
    """Register dynamic phenotype classes needed to reload frozen cohort JSON."""
    import phenex.util.serialization.from_dict as fd_module
    from phenex.phenotypes.phenotype import Phenotype

    if "_UserDefinedPhenotype" in fd_module.__dict__:
        return

    class _UserDefinedPhenotype(Phenotype):
        def __init__(self, returns_value=False, **kwargs):
            self.returns_value = returns_value
            super().__init__(**kwargs)

        def _execute(self, tables):
            raise NotImplementedError(
                "UserDefinedPhenotype cannot be re-executed from checkpoint; "
                "use report JSON rehydration only."
            )

    fd_module.__dict__["_UserDefinedPhenotype"] = _UserDefinedPhenotype


def load_study_from_checkpoint(
    study_cls,
    execution_path: str,
    database=None,
    *,
    require_success: bool = True,
):
    from phenex import load as phenex_load

    _ensure_checkpoint_deserializers()

    execution_path = os.path.abspath(execution_path)
    manifest_path = os.path.join(execution_path, "manifest.json")
    if not os.path.isfile(manifest_path):
        raise ValueError(f"manifest.json not found in {execution_path}")

    with open(manifest_path) as f:
        manifest = json.load(f)

    if manifest.get("manifest_version") != MANIFEST_VERSION:
        raise ValueError(
            f"Unsupported manifest_version: {manifest.get('manifest_version')!r}"
        )

    exit_state = manifest.get("execution", {}).get("exit_state")
    if require_success and exit_state == "Fail":
        error = manifest.get("execution", {}).get("error", "unknown error")
        raise ValueError(f"Cannot load failed execution (exit_state=Fail): {error}")

    cohorts = []
    for cohort_entry in manifest.get("cohorts", []):
        frozen_rel = cohort_entry.get("frozen_json")
        frozen_path = os.path.join(execution_path, frozen_rel)
        if not os.path.isfile(frozen_path):
            raise ValueError(f"Missing frozen cohort JSON: {frozen_rel}")
        with open(frozen_path) as f:
            cohort = phenex_load(f)
        if database is not None and cohort.database is None:
            cohort.database = database
        cohort_dir = os.path.join(
            execution_path, cohort_entry.get("directory", cohort.name)
        )
        cohort.load_reports_from_json(cohort_dir)
        cohorts.append(cohort)

    study_name = manifest.get("study_name")
    description = manifest.get("description")
    study_path = manifest.get("study_path")
    if study_path and os.path.basename(study_path) == study_name:
        init_path = os.path.dirname(study_path)
    else:
        init_path = study_path or os.path.dirname(os.path.dirname(execution_path))

    study = study_cls(
        path=init_path,
        name=study_name,
        cohorts=cohorts,
        description=description,
    )
    study.execution_path = execution_path
    study.exit_state = exit_state
    study.manifest = manifest
    return study
