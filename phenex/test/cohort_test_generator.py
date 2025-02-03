import yaml
import os
import pandas as pd

class CohortTestGenerator:
    """
    This class is a base class for all TestGenerators.

    FIXME Document how to subclass and use.
    """

    date_format = "%m-%d-%Y"

    def __init__(self):
        pass

    def run_tests(self, verbose=False):
        self.verbose = verbose
        self.cohort = self.define_cohort()
        self.mapped_tables = self.define_mapped_tables()

        self._create_artifact_directory(self.name_space)
        self._generate_output_artifacts()
        self._run_tests()

    def define_cohort(self):
        raise NotImplementedError

    def define_mapped_tables(self):
        raise NotImplementedError

    def define_expected_output(self):
        raise NotImplementedError

    def name_file(self, test_info):
        return f"{self.name_space}__{test_info['name']}"

    def name_output_file(self, test_info):
        return self.name_file(test_info) + "_output"

    def _generate_output_artifacts(self):

        self.test_infos = self.define_expected_output()
        for test_info in self.test_infos:
            df = test_info["df"]
            filename = self.name_output_file(test_info) + ".csv"
            path = os.path.join(self.dirpaths["output"], filename)
            df.to_csv(path, index=False, date_format=self.date_format)

    def _run_tests(self):
        pass

    def _create_artifact_directory(self, name_demo):
        path_artifacts = os.path.join("cohorts/artifacts", name_demo)

        self.dirpaths = {
            "artifacts": path_artifacts,
            "output": path_artifacts,
        }
        for _path in self.dirpaths.values():
            if not os.path.exists(_path):
                os.makedirs(_path)
