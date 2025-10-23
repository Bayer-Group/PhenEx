import os
import datetime

import pandas as pd
import ibis
from phenex.tables import PhenexTable, CodeTable

from phenex.test.util.check_equality import check_equality, check_start_end_date_equality


class DerivedTablesTestGenerator:
    """
    This class is a base class for testing derived tables.

    Follows the pattern of PhenotypeTestGenerator but with simpler output handling
    for derived tables.
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

    def define_derived_table_tests(self):
        raise NotImplementedError

    def _create_artifact_directory(self, name_derived_table):
        path_artifacts = os.path.join(
            os.path.dirname(__file__), "artifacts", name_derived_table
        )
        if not os.path.exists(path_artifacts):
            os.makedirs(path_artifacts)
        self.dirpaths = {
            "seeds": path_artifacts,
            "input": os.path.join(path_artifacts, "input_generated"),
            "expected": os.path.join(path_artifacts, "expected"),
            "result": os.path.join(path_artifacts, "result"),
        }
        for _path in self.dirpaths.values():
            if not os.path.exists(_path):
                os.makedirs(_path)

    def name_file(self, table_name):
        return f"{self.name_space}_{table_name}"

    def name_output_file(self, test_info):
        return f"{test_info['derived_table'].name}_output"

    def _create_input_data(self):
        self.tables = {}
        input_infos = self.define_input_tables()
        for input_info in input_infos:
            filename = self.name_file(input_info["name"]) + ".csv"
            path = os.path.join(self.dirpaths["input"], filename)
            # Save input data as CSV
            input_info["df"].to_csv(path, index=False, date_format=self.date_format)

            schema = {}
            for col in input_info["df"].columns:
                if "date" in col.lower():
                    schema[col] = datetime.date
                elif "value" in col.lower():
                    schema[col] = float
                else:
                    schema[col] = str

            table = self.con.create_table(
                input_info["name"], input_info["df"], schema=schema
            )
            
            if "type" in input_info.keys():
                table_type = input_info["type"]
            else:
                table_type = PhenexTable
                if input_info["name"].lower() in [
                    "condition_occurrence", "drug_exposure"
                ]:
                    table_type = CodeTable

            self.tables[input_info["name"]] = table_type(table)

    def _run_tests(self):
        self.test_infos = self.define_derived_table_tests()

        for test_info in self.test_infos:
            # Get expected output directly from the test_info
            expected_df = test_info["expected_df"]
            filename = self.name_output_file(test_info) + ".csv"
            path = os.path.join(self.dirpaths["expected"], filename)
            expected_df.to_csv(path, index=False, date_format=self.date_format)

            # Run the derived table execution
            result_table = test_info["derived_table"].execute(self.tables)

            if self.verbose:
                ibis.options.interactive = True
                print("PRINTING THE SQL")
                ibis.to_sql(result_table)
                print(
                    f"Running test: {test_info['name']}\nExpected output:\n{expected_df}\nActualOutput:\n{result_table}\n\n"
                )
            
            path = os.path.join(self.dirpaths["result"], filename)
            result_table.to_pandas().to_csv(
                path, index=False, date_format=self.date_format
            )

            # Create schema for expected output
            schema = {}
            for col in expected_df.columns:
                if "date" in col.lower():
                    schema[col] = datetime.date
                elif "value" in col.lower():
                    schema[col] = self.value_datatype
                elif "boolean" in col.lower():
                    schema[col] = bool
                else:
                    schema[col] = str

            expected_output_table = self.con.create_table(
                self.name_output_file(test_info), expected_df, schema=schema
            )

            # Check equality based on the type of derived table
            if "START_DATE" in expected_df.columns and "END_DATE" in expected_df.columns:
                check_start_end_date_equality(
                    result_table,
                    expected_output_table,
                    test_name=test_info["name"],
                    join_on=test_info.get("join_on", ["PERSON_ID", "START_DATE", "END_DATE"])
                )
            else:
                join_on = test_info.get("join_on", ["PERSON_ID"])
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
                    join_on=join_on
                )