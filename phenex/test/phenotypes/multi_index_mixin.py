"""
MultiIndexMixin – duplicates test input data with a second INDEX_DATE
and adapts the test runner to verify results per (PERSON_ID, INDEX_DATE).

Each test class can set ``_shift`` to control the INDEX_DATE offset.
The module-level ``SHIFT`` (90 days) is the default.
"""
import datetime
import os

import pandas as pd
import ibis

from phenex.test.util.check_equality import check_equality


SHIFT = datetime.timedelta(days=90)


class MultiIndexMixin:
    """Mixin that duplicates input data with a second INDEX_DATE and adapts
    the test runner to verify results per (PERSON_ID, INDEX_DATE).

    Set ``_shift`` on the subclass to override the default 90-day shift.
    """

    _shift = SHIFT  # subclasses may override

    @property
    def shift(self):
        return self._shift

    def _duplicate_input_tables(self, input_tables):
        """Duplicate all rows with a second INDEX_DATE shifted by self.shift.
        
        Tables without INDEX_DATE get the column added (using self._index_date)
        before duplication so that every domain table carries the index.
        """
        result = []
        for info in input_tables:
            df = info["df"].copy()
            if "INDEX_DATE" not in df.columns:
                df["INDEX_DATE"] = self._index_date
            df2 = df.copy()
            df2["INDEX_DATE"] = pd.to_datetime(df2["INDEX_DATE"]) + self.shift
            combined = pd.concat([df, df2], ignore_index=True)
            result.append({**info, "df": combined})
        return result

    def _duplicate_expected(self, test_infos, index_date):
        """Duplicate expected persons / dates / values for the second INDEX_DATE."""
        for info in test_infos:
            n = len(info["persons"])
            info["index_dates"] = [index_date] * n + [index_date + self.shift] * n
            info["persons"] = list(info["persons"]) * 2
            if info.get("dates") is not None:
                info["dates"] = list(info["dates"]) * 2
            if info.get("values") is not None:
                info["values"] = list(info["values"]) * 2
        return test_infos

    def _run_tests(self):
        """Override: includes INDEX_DATE in expected output and join predicates."""

        def df_from_test_info(test_info):
            df = pd.DataFrame()
            df["PERSON_ID"] = test_info["persons"]
            df["INDEX_DATE"] = test_info["index_dates"]
            df["boolean"] = True
            if test_info.get("dates") is not None:
                df["EVENT_DATE"] = test_info["dates"]
            else:
                df["EVENT_DATE"] = None
            if test_info.get("values") is not None:
                df["VALUE"] = test_info["values"]
            else:
                df["VALUE"] = None
            return df

        self.test_infos = self.define_phenotype_tests()

        for test_info in self.test_infos:
            df = df_from_test_info(test_info)
            filename = self.name_output_file(test_info) + ".csv"
            path = os.path.join(self.dirpaths["expected"], filename)
            df.sort_values(by=["PERSON_ID", "INDEX_DATE"]).to_csv(
                path, index=False, date_format=self.date_format
            )

            result_table = test_info["phenotype"].execute(self.domains)

            if self.verbose:
                ibis.options.interactive = True
                print(f"Running test: {test_info['name']}")
                print(f"Expected:\n{df}")
                print(f"Result:\n{result_table.to_pandas()}")

            path = os.path.join(self.dirpaths["result"], filename)
            result_table.to_pandas().sort_values(
                by=["PERSON_ID", "INDEX_DATE"]
            ).to_csv(path, index=False, date_format=self.date_format)

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

            join_on = ["PERSON_ID", "INDEX_DATE"]
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
