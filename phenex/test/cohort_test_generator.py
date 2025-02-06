import yaml
import os
import pandas as pd
import ibis

from phenex.reporting import InExCounts, Waterfall
from .util.check_equality import check_counts_table_equal


class CohortTestGenerator:
    """
    This class is a base class for all TestGenerators.

    FIXME Document how to subclass and use.
    """

    date_format = "%m-%d-%Y"

    def __init__(self):
        pass

    def run_tests(self, path="phenex/test/cohort", verbose=False):
        self.verbose = verbose
        self.cohort = self.define_cohort()
        self.mapped_tables = self.define_mapped_tables()

        self._create_artifact_directory(self.cohort.name, path)
        self._generate_output_artifacts()
        self._run_tests()

    def define_cohort(self):
        raise NotImplementedError

    def define_mapped_tables(self):
        raise NotImplementedError

    def define_expected_output(self):
        raise NotImplementedError

    def name_file(self, test_info):
        return f"{self.cohort.name}__{test_info['name']}"

    def name_output_file(self, test_info):
        return self.name_file(test_info) + "_output"

    def _generate_output_artifacts(self):
        self.test_infos = self.define_expected_output()
        for test_name, df in self.test_infos.items():
            filename = test_name + ".csv"
            path = os.path.join(self.dirpaths["expected"], filename)
            df.to_csv(path, index=False, date_format=self.date_format)

    def _run_tests(self):
        self.cohort.execute(self.mapped_tables)

        # get inclusion exclusion counts and compare
        r = InExCounts()
        r.execute(self.cohort)
        r.df_counts_inclusion.to_csv(
            os.path.join(self.dirpaths["result"], "counts_inclusion.csv"), index=False
        )
        r.df_counts_exclusion.to_csv(
            os.path.join(self.dirpaths["result"], "counts_exclusion.csv"), index=False
        )
        if len(self.cohort.inclusions) > 0:
            check_counts_table_equal(
                result=r.df_counts_inclusion,
                expected=self.test_infos["counts_inclusion"],
                test_name=self.cohort.name + "_inclusion",
            )
        if len(self.cohort.exclusions) > 0:
            check_counts_table_equal(
                result=r.df_counts_exclusion,
                expected=self.test_infos["counts_exclusion"],
                test_name=self.cohort.name + "_exclusion",
            )
        r = Waterfall()
        r.execute(self.cohort)

    def _create_artifact_directory(self, name_demo, path):
        if os.path.exists(path):
            path_artifacts = os.path.join(path, "artifacts")
        else:
            raise ValueError(
                "Pass a path to the cohort test generator where expected and calculated output should be written"
            )
        path_cohort = os.path.join(path_artifacts, name_demo)

        self.dirpaths = {
            "artifacts": path_artifacts,
            "cohort": path_cohort,
            "expected": os.path.join(path_cohort, "expected"),
            "result": os.path.join(path_cohort, "result"),
        }
        for _path in self.dirpaths.values():
            if not os.path.exists(_path):
                os.makedirs(_path)
