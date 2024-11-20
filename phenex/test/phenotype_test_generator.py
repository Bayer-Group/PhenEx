import os
import datetime

import pandas as pd
import ibis
import ibis.expr.datatypes as dt
from pyarrow import int8

from .util.check_equality import check_equality

import logging


class PhenotypeTestGenerator:
    """
    This class is a base class for all TestGenerators.

    FIXME Document how to subclass and use.
    """

    name_space = ""
    date_format = "%m-%d-%Y"
    test_values = False
    value_datatype = float
    test_date = False
    join_on = ["PERSON_ID"]

    def run_tests(self, verbose=False):
        self.verbose = verbose
        self.con = ibis.duckdb.connect()
        self._create_artifact_directory(self.name_space)
        self._create_input_data()
        self._run_tests()

    def define_input_tables(self):
        raise NotImplementedError

    def define_phenotype_tests(self):
        raise NotImplementedError

    def _create_artifact_directory(self, name_phenotype):
        path_artificats = os.path.join(
            os.path.dirname(__file__), "phenotypes/artifacts", name_phenotype
        )
        if not os.path.exists(path_artificats):
            os.makedirs(path_artificats)
        self.dirpaths = {
            "seeds": path_artificats,
            "input": os.path.join(path_artificats, "input_generated"),
            "expected": os.path.join(path_artificats, "expected"),
            "result": os.path.join(path_artificats, "result"),
        }
        for _path in self.dirpaths.values():
            if not os.path.exists(_path):
                os.makedirs(_path)

    def name_file(self, table_name):
        return f"{self.name_space}_{table_name}"

    def name_output_file(self, test_info):
        return f"{test_info['phenotype'].name}_output"

    def _create_input_data(self):
        self.domains = {}
        input_infos = self.define_input_tables()
        for input_info in input_infos:
            filename = self.name_file(input_info["name"]) + ".csv"
            path = os.path.join(self.dirpaths["input"], filename)
            # NOTE Depending on which database you are using, dates in the seed
            # data may have to be in a different format. It's best to keep your
            # seed data dates in pandas datetime format and let the
            # TestGenerator format them into strings.
            input_info["df"].to_csv(path, index=False, date_format=self.date_format)

            schema = {}
            for col in input_info["df"].columns:
                if "date" in col.lower():
                    schema[col] = datetime.date
                elif "value" in col.lower():
                    schema[col] = float
                else:
                    schema[col] = str

            self.domains[input_info["name"]] = self.con.create_table(
                input_info["name"], input_info["df"], schema=schema
            )

    def _run_tests(self):
        def df_from_test_info(test_info):
            df = pd.DataFrame()
            df["PERSON_ID"] = test_info["persons"]

            columnname_boolean = "boolean"
            columnname_date = "EVENT_DATE"
            columnname_value = "VALUE"

            df[columnname_boolean] = True

            if test_info.get("dates") is not None:
                df[columnname_date] = test_info["dates"]
            else:
                test_info[columnname_date] = ibis.null(type=datetime.date)

            if test_info.get("values") is not None:
                df[columnname_value] = test_info["values"]
            else:
                df[columnname_value] = None

            return df

        self.test_infos = self.define_phenotype_tests()

        for test_info in self.test_infos:
            df = df_from_test_info(test_info)
            filename = self.name_output_file(test_info) + ".csv"
            path = os.path.join(self.dirpaths["expected"], filename)
            # NOTE Depending on which database you are using, dates in the seed
            # data may have to be in a different format. It's best to keep your
            # seed data dates in pandas datetime format and let the
            # TestGenerator format them into strings.
            print(path)
            df.to_csv(path, index=False, date_format=self.date_format)

            result_table = test_info["phenotype"].execute(self.domains)

            if self.verbose:
                ibis.options.interactive = True
                print("PRINTING THE SQL")
                ibis.to_sql(result_table)
                print(
                    f"Running test: {test_info['name']}\nExpected output:\n{df}\nActualOutput:\n{result_table}\n\n"
                )
            path = os.path.join(self.dirpaths["result"], filename)
            result_table.to_pandas().to_csv(
                path, index=False, date_format=self.date_format
            )

            schema = {}
            for col in df.columns:
                if "date" in col.lower():
                    schema[col] = datetime.date
                elif "value" in col.lower():
                    schema[col] = self.value_datatype
                elif "boolean" in col.lower():
                    schema[col] = bool
                else:
                    schema[col] = str

            expected_output_table = self.con.create_table(
                self.name_output_file(test_info), df, schema=schema
            )

            join_on = ["PERSON_ID"]
            if self.test_values:
                join_on.append("VALUE")
            if self.test_date:
                join_on.append("EVENT_DATE")
            check_equality(
                result_table,
                expected_output_table,
                test_name=test_info["name"],
                test_values=self.test_values,
                test_date=self.test_date,
                join_on=join_on,
            )
