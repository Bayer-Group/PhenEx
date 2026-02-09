import os, datetime, json, sys
from typing import List, Dict, Optional
from importlib.metadata import version, PackageNotFoundError

from phenex.node import Node, NodeGroup
import ibis
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.util.output_concatenator import OutputConcatenator
from phenex.core.cohort import Cohort
from phenex.reporting import Waterfall
from phenex import dump

logger = create_logger(__name__)


class Study:
    """
    The Study

    Parameters:


    Attributes:

    """

    def __init__(
        self,
        path: str,
        name: str,
        cohorts: List[Cohort],
        custom_reporters: List["Reporter"] = None,
    ):
        self.path = path
        self.name = name
        self.cohorts = cohorts
        self.custom_reporters = custom_reporters

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
    ):
        path_exec_dir_study = self._prepare_study_execution_directory()
        self._freeze_software_versions(path_exec_dir_study)

        waterfall_reporter = Waterfall()
        self.custom_reporters = [waterfall_reporter] + (self.custom_reporters or [])

        for _cohort in self.cohorts:
            path_exec_dir_cohort = self._prepare_cohort_execution_directory(
                _cohort, path_exec_dir_study
            )
            self._save_serialized_cohort(_cohort, path_exec_dir_cohort)

            _cohort.execute(
                overwrite=overwrite, lazy_execution=lazy_execution, n_threads=n_threads
            )

            path_table = os.path.join(path_exec_dir_cohort, "table1.xlsx")
            _cohort.table1.to_excel(path_table)

            if self.custom_reporters is not None:
                for reporter in self.custom_reporters:
                    reporter.execute(_cohort)
                    report_filename = reporter.__class__.__name__
                    print("executing reporter", report_filename, reporter.df)
                    reporter.to_excel(
                        os.path.join(path_exec_dir_cohort, report_filename + ".xlsx")
                    )

        self._concatenate_reports(path_exec_dir_study)

    def _prepare_study_execution_directory(self):
        now = datetime.datetime.today()
        dirname = now.strftime("D%Y-%m-%d__T%H-%M")
        path = os.path.join(self.path, dirname)
        print(path)
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

        # Get PhenEx version
        try:
            phenex_version = version("phenex")
        except PackageNotFoundError:
            phenex_version = "unknown (package not installed)"

        # Write to file
        with open(info_path, "w") as f:
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
        _path = os.path.join(path_exec_dir_cohort, cohort.name + ".json")
        with open(_path, "w") as f:
            dump(cohort, f, indent=4)

    def _concatenate_reports(self, path_exec_dir_study):
        """Concatenate all cohort reports into a single Excel file."""
        concatenator = OutputConcatenator(path_exec_dir_study)
        concatenator.concatenate_all_reports()
