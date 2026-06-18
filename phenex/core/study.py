import os, datetime, json
from typing import List, Dict, Optional

import pandas as pd
from phenex.node import Node, NodeGroup
import ibis
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.util.output_concatenator import OutputConcatenator
from phenex.core.cohort import Cohort
from phenex.reporting import Waterfall

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
    ):
        self.path = path
        self.name = name
        self.cohorts = cohorts
        self.custom_reporters = custom_reporters
        self.description = description

        self.execution_path = None
        self.exit_state = None
        self.manifest = None

        self._create_study_output_path()
        self._check_cohort_names_unique()
        self._check_cohorts_have_databases()

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

    def _check_cohorts_have_databases(self):
        missing_database = []
        for cohort in self.cohorts:
            if cohort.database is None:
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
    ):
        from phenex.core.study_manifest import run_study_execute

        run_study_execute(
            self,
            overwrite=overwrite,
            n_threads=n_threads,
            lazy_execution=lazy_execution,
            previous_executions=previous_executions,
        )

    @classmethod
    def load_from_checkpoint(
        cls,
        execution_path: str,
        database=None,
        *,
        require_success: bool = True,
    ) -> "Study":
        from phenex.core.study_manifest import load_study_from_checkpoint

        return load_study_from_checkpoint(
            cls,
            execution_path,
            database,
            require_success=require_success,
        )

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
        return _path

    def _concatenate_reports(self, path_exec_dir_study):
        """Concatenate all cohort reports into a single Excel file."""
        cohort_names = [c.name for c in self.cohorts]
        concatenator = OutputConcatenator(
            path_exec_dir_study,
            study_name=self.name,
            cohort_names=cohort_names,
            description=self.description,
        )
        concatenator.concatenate_all_reports()

    @property
    def table1(self):
        """
        Concatenate every cohort's Table1 report into a single DataFrame.

        Each cohort's Table1 is stacked vertically with an additional ``cohort``
        column identifying the source cohort by name. This provides a convenient
        side-by-side view of baseline characteristics across all cohorts in the
        study.

        Returns:
            A pandas DataFrame containing all cohorts' Table1 rows, with a
            ``cohort`` column holding the originating cohort's name.

        Raises:
            ValueError: If any cohort has not produced a Table1 report (i.e.
                ``cohort.table1`` is None). Execute the study before accessing
                this property.
        """
        dfs = []
        for cohort in self.cohorts:
            df = cohort.table1
            if df is None:
                raise ValueError(
                    f"Cohort '{cohort.name}' has no table1 report; cannot build "
                    "the study table1. Execute the study before accessing table1."
                )
            dfs.append(df.assign(cohort=cohort.name))
        return pd.concat(dfs, ignore_index=True)
