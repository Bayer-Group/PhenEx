import yaml
import os
import pandas as pd
import ibis

from phenex.reporting import InExCounts, Waterfall
from .util.check_equality import check_counts_table_equal, check_equality
from phenex.util import create_logger

logger = create_logger(__name__)


def sort_by_personid(_df):
    _df["id"] = [int(x.replace("P", "")) for x in _df["PERSON_ID"].values]
    return _df.sort_values(by="id").drop("id", axis=1)


class CohortTestGenerator:
    """
    This class is a base class for all TestGenerators.

    FIXME Document how to subclass and use.
    """

    date_format = "%m-%d-%Y"
    test_values = False
    test_date = False

    def __init__(self):
        pass

    def run_tests(self, path="phenex/test/cohort", verbose=False):
        self.verbose = verbose
        self.cohort = self.define_cohort()

        self._create_artifact_directory(self.cohort.name, path)
        self.mapped_tables = self.define_mapped_tables()
        self._write_mapped_tables()
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

    def _write_mapped_tables(self):
        for domain, table in self.mapped_tables.items():
            path = os.path.join(self.dirpaths["mapped_tables"], f"{domain}.csv")
            table.to_pandas().to_csv(path, index=False)

    def _run_tests(self):
        self.cohort.execute(self.mapped_tables)

        logger.debug(
            f"\nENTRY\n{sort_by_personid(self.cohort.entry_criterion.table.to_pandas())}"
        )
        if len(self.cohort.inclusions) > 0:
            logger.debug(
                f"\nINCLUSIONS\n{sort_by_personid(self.cohort.inclusions_table.to_pandas())}"
            )

        if len(self.cohort.exclusions) > 0:
            logger.debug(
                f"\nEXCLUSIONS\n{sort_by_personid(self.cohort.exclusions_table.to_pandas())}"
            )
        r = Waterfall()
        logger.debug(f"\nWATERFALL\n{r.execute(self.cohort)}")
        logger.debug(
            f"\nINDEX\n{sort_by_personid(self.cohort.index_table.to_pandas())}"
        )

        if (
            "counts_inclusion" in self.test_infos.keys()
            or "counts_exclusion" in self.test_infos.keys()
        ):
            self._test_inex_counts()

        if "index" in self.test_infos.keys():
            self._test_index_table(
                result=self.cohort.index_table, expected=self.test_infos["index"]
            )

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
            "mapped_tables": os.path.join(path_cohort, "mapped_tables"),
        }
        for _path in self.dirpaths.values():
            if not os.path.exists(_path):
                os.makedirs(_path)

    def _test_index_table(self, result, expected):
        name = self.cohort.name + "_index"
        expected_output_table = self.con.create_table(name, expected)
        join_on = ["PERSON_ID"]
        if self.test_values:
            join_on.append("VALUE")
        if self.test_date:
            join_on.append("EVENT_DATE")
        check_equality(
            result,
            expected_output_table,
            test_name=self.cohort.name + "_index",
            test_values=self.test_values,
            test_date=self.test_date,
            join_on=join_on,
        )

    def _test_inex_counts(self):
        # compute inclusion exclusion counts
        r = InExCounts()
        r.execute(self.cohort)
        # write expected results to artifacts
        r.df_counts_inclusion.to_csv(
            os.path.join(self.dirpaths["result"], "counts_inclusion.csv"), index=False
        )
        r.df_counts_exclusion.to_csv(
            os.path.join(self.dirpaths["result"], "counts_exclusion.csv"), index=False
        )
        # test results
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
