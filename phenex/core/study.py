import os, datetime, json, logging, sys
from typing import List, Dict, Optional

from phenex.node import Node, NodeGroup
from phenex.core.database import Database
import ibis
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.util.progress import resolve_display, study_console
from phenex.util.output_concatenator import OutputConcatenator
from phenex.core.cohort import Cohort
from phenex.reporting import Waterfall
from phenex.reporting.static_report_builder import build_static_report

logger = create_logger(__name__)


class Study:
    """
    Orchestrates the execution of multiple cohorts and aggregates their reports.

    A Study manages the execution of one or more cohorts, automatically generating standardized reports (Waterfall, Table1) for each cohort and concatenating them into a single multi-sheet Excel file for easy comparison. Each execution creates a timestamped directory containing individual cohort outputs and a combined study results file.

    Parameters:
        path: Base directory where study outputs will be saved. A subdirectory with the study name will be created if it doesn't exist.
        name: Name of the study. Used for directory naming and identification.
        cohorts: List of Cohort objects to execute. Each cohort must have a unique name and an assigned database.
        custom_reporters: Additional reporters to run on each cohort. A Waterfall and Table1 reporter is always included by default.
        description: A plain text description of the study.
        database: Optional database to use for all cohorts that do not have a database already defined. If a cohort already has a database, a warning is issued and the cohort-level database is used. If this is not provided, every cohort must have a database defined or an error is raised.

    Example:
    ```python
        # will write to output path ./my_study
        # every time we execute, a new directory with date and time will be added
        # within it, a directory with each cohort's output is created and
        # a combined study_results.xlsx file with all reports concatenated
        study1 = Study(
            name = "my_study",
            path = "./",
            cohorts = [cohort1, cohort2],
        )
        study1.execute()

    ```

    """

    def __init__(
        self,
        path: str,
        name: str,
        cohorts: List[Cohort],
        custom_reporters: List["Reporter"] = None,
        description: Optional[str] = None,
        database: Optional[Database] = None,
    ):
        self.path = path
        self.name = name
        self.cohorts = cohorts
        self.custom_reporters = custom_reporters
        self.description = description
        self.database = database
        self.execution_directory = None

        self._create_study_output_path()
        self._check_cohort_names_unique()
        self._assign_and_check_databases()

    def _create_study_output_path(self):
        # ensure that the output path directory is the name of the study
        if self.path.split(os.sep)[-1] != self.name:
            self.path = os.path.join(self.path, self.name)
        # ensure directory exists
        if not os.path.exists(self.path):
            os.makedirs(self.path)

    def _check_cohort_names_unique(self):
        all_names = [x.name for x in self.cohorts]
        unique_names = list(set(all_names))
        if len(all_names) != len(unique_names):
            raise ValueError(
                f"Ensure that cohort names are unique; found cohort names {sorted(all_names)}"
            )

    def _assign_and_check_databases(self):
        missing_database = []
        self._cohorts_with_own_database = []
        for cohort in self.cohorts:
            if cohort.database is not None:
                if self.database is not None:
                    self._cohorts_with_own_database.append(cohort.name)
            else:
                if self.database is not None:
                    cohort.database = self.database
                else:
                    missing_database.append(cohort)
        if len(missing_database) > 0:
            raise ValueError(
                f"Cohorts must have databases defined in order for use in a Study. Cohorts missing database : {[x.name for x in missing_database]}"
            )

    def execute(
        self,
        overwrite: Optional[bool] = False,
        n_threads: Optional[int] = 1,
        lazy_execution: Optional[bool] = False,
        previous_executions: Optional[Dict[str, str]] = None,
        verbosity: Optional[str] = None,
    ):
        """Execute all cohorts, writing each one's reports and per-node SQL into a fresh
        timestamped run directory under `self.path`.

        `verbosity` controls the execution progress display and is passed
        through to each cohort's execute(); see Cohort.execute for values.

        Returns:
            str: Path to this run's directory (also on `self.execution_directory`).
        """
        with study_console(verbosity) as pxconsole:
            path_exec_dir_study = self._prepare_study_execution_directory()
            self.execution_directory = path_exec_dir_study

            # Add a file handler to the root phenex logger so all phenex.* loggers
            # write to analysis.log for this execution run.
            log_path = os.path.join(path_exec_dir_study, "analysis.log")
            file_handler = logging.FileHandler(log_path)
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                )
            )
            phenex_root_logger = logging.getLogger("phenex")
            phenex_root_logger.addHandler(file_handler)
            warnings_logger = logging.getLogger("py.warnings")
            warnings_logger.addHandler(file_handler)

            if self._cohorts_with_own_database:
                # Recorded at construction, reported here, where analysis.log exists
                logger.info(
                    f"Study '{self.name}': "
                    f"{len(self._cohorts_with_own_database)} cohort(s) use their own "
                    f"database instead of the study-level one: "
                    f"{', '.join(self._cohorts_with_own_database)}."
                )

            pxconsole.note(f"Results folder: {path_exec_dir_study}")
            pxconsole.note(
                "Progress bars are on · analysis.log in the results folder "
                "records the complete run live: every log message of every "
                "level · to see plain text logs here instead, run without "
                "verbosity='debug'",
                style="cyan",
            )

            self._freeze_software_versions(path_exec_dir_study)
            self.custom_reporters = self.custom_reporters or []
            previous_executions = previous_executions or {}
            parents_requiring_execution = self._get_parents_requiring_execution(
                previous_executions
            )

            status = "success"
            error_message = None
            try:
                for _cohort in self.cohorts:
                    path_exec_dir_cohort = self._prepare_cohort_execution_directory(
                        _cohort, path_exec_dir_study
                    )

                    if self._should_use_previous_execution(
                        _cohort, previous_executions, parents_requiring_execution
                    ):
                        if self._copy_previous_execution(
                            _cohort,
                            previous_executions[_cohort.name],
                            path_exec_dir_cohort,
                        ):
                            pxconsole.note(
                                f"Cohort '{_cohort.name}': reusing results from an earlier run"
                            )
                            continue

                    self._save_serialized_cohort(_cohort, path_exec_dir_cohort)

                    # Merge study-level custom reporters into the cohort before execution.
                    # Save and restore so repeated calls to study.execute() don't accumulate duplicates.
                    _original_custom_reporters = _cohort.custom_reporters
                    _cohort.custom_reporters = (
                        _original_custom_reporters or []
                    ) + self.custom_reporters

                    # Each cohort's SQL goes in its own run directory.
                    _cohort.execute(
                        overwrite=overwrite,
                        lazy_execution=lazy_execution,
                        n_threads=n_threads,
                        sql_dir=os.path.join(path_exec_dir_cohort, "sql"),
                        verbosity=verbosity,
                    )

                    _cohort.custom_reporters = _original_custom_reporters

                    # Saving is its own session: a bar over the report files, the one
                    # being written named beneath it, one timed line per report.
                    saving = resolve_display(verbosity)
                    with saving.cohort_session(
                        _cohort.name, kind="Saving reports", collapse=True
                    ):
                        _cohort.write_reports_to_json(path_exec_dir_cohort)
                        _cohort.write_reports_to_html(path_exec_dir_cohort)

                combining = resolve_display(verbosity)
                with combining.cohort_session(
                    self.name, kind="Combining reports", collapse=True
                ):
                    self._concatenate_reports(path_exec_dir_study)
                logger.info(
                    f"Study '{self.name}' execution complete. Output written to: {path_exec_dir_study}"
                )
            except KeyboardInterrupt:
                status = "interrupted"
                raise
            except Exception as e:
                status = "failed"
                error_message = str(e)
                raise
            finally:
                self._write_manifest(
                    path_exec_dir_study, status=status, error_message=error_message
                )
                phenex_root_logger.removeHandler(file_handler)
                warnings_logger.removeHandler(file_handler)
                file_handler.close()

            pxconsole.note(
                f"Study '{self.name}' done · results: {path_exec_dir_study} · "
                f"full text log: analysis.log",
                strong=True,
            )
        return path_exec_dir_study

    def load(self, verbosity: Optional[str] = None) -> "Study":
        """
        Point every cohort back at the tables a previous run already wrote,
        without computing anything. Use it in a fresh session after re-running
        the cells that define the study, instead of execute().

        Each database is asked once which tables it holds. Parent cohorts are
        loaded before their subcohorts. Nothing is written: no results folder,
        no log file.
        """
        from phenex.core.cohort import _list_dest_tables
        from phenex.core.subcohort import Subcohort

        with study_console(verbosity) as pxconsole:
            pxconsole.note(
                f"Study '{self.name}': loading executed results (no computation)"
            )
            self.custom_reporters = self.custom_reporters or []
            ordered = [c for c in self.cohorts if not isinstance(c, Subcohort)] + [
                c for c in self.cohorts if isinstance(c, Subcohort)
            ]
            listings = {}
            for cohort in ordered:
                con = cohort.database.connector
                if id(con) not in listings:
                    listings[id(con)] = _list_dest_tables(con)
                    if listings[id(con)] is None:
                        pxconsole.note(
                            f"Destination database for cohort '{cohort.name}' not "
                            f"found; its tables will load as None",
                            style="yellow",
                        )
                # Add the study's own reports to the cohort, as execute() does,
                # so their saved tables are reachable too; undone right after
                _original_custom_reporters = cohort.custom_reporters
                cohort.custom_reporters = (
                    _original_custom_reporters or []
                ) + self.custom_reporters
                try:
                    cohort.load(con=con, _existing_tables=listings[id(con)] or set())
                finally:
                    cohort.custom_reporters = _original_custom_reporters
                # the same line the plain log shows, yellow when it is a warning
                pxconsole.note(
                    getattr(cohort, "_load_summary", f"Cohort '{cohort.name}': loaded"),
                    style=(
                        "yellow"
                        if getattr(cohort, "_load_summary_is_warning", False)
                        else None
                    ),
                )
        return self

    def _write_manifest(
        self, path_exec_dir_study, status="success", error_message=None
    ):
        """Write manifest.json with execution metadata and a list of all generated files."""
        from phenex import __version__ as phenex_version

        files = []
        for dirpath, _, filenames in os.walk(path_exec_dir_study):
            for fname in sorted(filenames):
                abs_path = os.path.join(dirpath, fname)
                rel_path = os.path.relpath(abs_path, path_exec_dir_study)
                files.append(rel_path)

        manifest = {
            "study_name": self.name,
            "execution_timestamp": datetime.datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            "status": status,
            "error_message": error_message,
            "phenex_version": phenex_version,
            "python_version": sys.version,
            "cohorts": [c.name for c in self.cohorts],
            "files": sorted(files),
        }

        manifest_path = os.path.join(path_exec_dir_study, "manifest.json")
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=4)

        logger.info(f"Manifest written to {manifest_path}")

    def _should_use_previous_execution(
        self, cohort, previous_executions, parents_requiring_execution
    ):
        """Check if a cohort should reuse results from a previous execution."""
        return (
            cohort.name in previous_executions
            and cohort.name not in parents_requiring_execution
        )

    def _get_parents_requiring_execution(self, previous_executions):
        """Identify parent cohorts that must be re-executed because a new subcohort needs them.

        If a Subcohort is not in ``previous_executions`` (i.e. it will be
        executed), its parent cohort must also be executed so that
        ``subset_tables_entry`` and ``index_table`` are available in memory.
        """
        from phenex.core.subcohort import Subcohort

        parents = set()
        for _cohort in self.cohorts:
            if (
                isinstance(_cohort, Subcohort)
                and _cohort.name not in previous_executions
            ):
                parent_name = _cohort.cohort.name
                if parent_name in previous_executions:
                    parents.add(parent_name)
        return parents

    def _copy_previous_execution(self, cohort, timestamp, path_exec_dir_cohort):
        """Copy all output files from a previous execution directory.

        Searches ``self.path / <timestamp> / <cohort.name>`` for the previous
        results.  Returns ``True`` if the copy succeeded.  If the directory is
        not found, emits a warning and returns ``False`` so the caller can
        fall back to re-execution.
        """
        import shutil

        previous_cohort_dir = os.path.join(self.path, timestamp, cohort.name)

        if not os.path.exists(previous_cohort_dir):
            logger.warning(
                f"Previous execution directory not found for cohort '{cohort.name}' "
                f"at '{previous_cohort_dir}'. Re-executing cohort."
            )
            return False

        for item in os.listdir(previous_cohort_dir):
            src = os.path.join(previous_cohort_dir, item)
            dst = os.path.join(path_exec_dir_cohort, item)
            if os.path.isfile(src):
                shutil.copy2(src, dst)
            elif os.path.isdir(src):
                shutil.copytree(src, dst)

        logger.info(
            f"Copied previous execution results for cohort '{cohort.name}' "
            f"from '{previous_cohort_dir}'"
        )
        return True

    def _prepare_study_execution_directory(self):
        now = datetime.datetime.today()
        dirname = now.strftime("D%Y-%m-%d__T%H-%M")
        path = os.path.join(self.path, dirname)
        if os.path.exists(path):
            logger.warning(f"Output directory {path} already exists!")
        else:
            logger.info(f"Creating output directory for study execution : {path}")
            os.makedirs(path)
        return path

    def _freeze_software_versions(self, path_exec_dir_study):
        """Store Python and PhenEx versions in info.txt file for reproducibility."""
        info_path = os.path.join(path_exec_dir_study, "info.txt")

        # Get Python version
        python_version = sys.version

        # Get PhenEx version from live source code
        from phenex import __version__ as phenex_version

        # Write to file
        with open(info_path, "w") as f:
            f.write(f"Study Name: {self.name}\n")
            f.write("Software Environment Information\n")
            f.write("=" * 50 + "\n\n")
            f.write(
                f"Study Execution Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            )
            f.write(f"Python Version:\n{python_version}\n\n")
            f.write(f"PhenEx Version: {phenex_version}\n")

        logger.info(f"Software version information saved to {info_path}")

    def _prepare_cohort_execution_directory(self, cohort, path_exec_dir_study):
        _path = os.path.join(path_exec_dir_study, cohort.name)
        if not os.path.exists(_path):
            os.makedirs(_path)
        return _path

    def _save_serialized_cohort(self, cohort, path_exec_dir_cohort):
        from phenex import dump

        _path = os.path.join(path_exec_dir_cohort, "frozen_" + cohort.name + ".json")
        with open(_path, "w") as f:
            dump(cohort, f, indent=4)

    def _concatenate_reports(self, path_exec_dir_study):
        """Concatenate all cohort reports into Excel, combined JSON, and index.html."""
        cohort_names = [c.name for c in self.cohorts]
        concatenator = OutputConcatenator(
            path_exec_dir_study,
            study_name=self.name,
            cohort_names=cohort_names,
            description=self.description,
        )
        concatenator.concatenate_all_reports()
        build_static_report(path_exec_dir_study)
