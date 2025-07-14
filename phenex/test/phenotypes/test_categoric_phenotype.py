import datetime, os
import pandas as pd

from phenex.phenotypes.categorical_phenotype import CategoricalPhenotype
from phenex.filters import CategoricalFilter, RelativeTimeRangeFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class CategoricalPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "cgpt"

    def define_input_tables(self):
        def add_flag(df, flag_name, flag_values):
            dfs = []
            for flag in flag_values:
                _df = df.copy()
                _df[flag_name] = flag
                dfs.append(_df)
            return pd.concat(dfs)

        df = pd.DataFrame()
        df["PERSON_ID"] = ["p1"]
        df["CODE"] = ["c1"]
        df["CODE_TYPE"] = ["ICD10CM"]
        df = add_flag(df, "x", ["x1", "x2"])
        df = add_flag(df, "y", ["y1", "y2"])
        df = add_flag(df, "z", ["z1", "z2"])
        df["PERSON_ID"] = [f"P{i}" for i in range(df.shape[0])]

        return [{"name": "person", "df": df}]

    def define_phenotype_tests(self):
        c1 = {
            "name": "single_flag",
            "persons": [f"P{i}" for i in range(4)],
            "phenotype": CategoricalPhenotype(
                domain="person",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1"],
                    column_name="z",
                ),
            ),
        }

        c2 = {
            "name": "two_categorical_filter_or",
            "persons": [f"P{i}" for i in range(4)] + [f"P{i}" for i in range(6, 8)],
            "phenotype": CategoricalPhenotype(
                domain="person",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1", "y2"], column_name="z", domain="person"
                )
                | CategoricalFilter(
                    allowed_values=["y2"], column_name="y", domain="person"
                ),
            ),
        }

        c3 = {
            "name": "two_categorical_filter_and",
            "persons": [f"P{i}" for i in range(2, 4)],
            "phenotype": CategoricalPhenotype(
                domain="person",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1"], column_name="z", domain="person"
                )
                & CategoricalFilter(
                    allowed_values=["y2"], column_name="y", domain="person"
                ),
            ),
        }

        test_infos = [c1, c2, c3]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class CategoricalPhenotypeWithDateTestGenerator(PhenotypeTestGenerator):
    name_space = "cgpt_with_time"

    def define_input_tables(self):
        def add_flag(df, flag_name, flag_values):
            dfs = []
            for flag in flag_values:
                _df = df.copy()
                _df[flag_name] = flag
                dfs.append(_df)
            return pd.concat(dfs)

        df = pd.DataFrame()
        df["PERSON_ID"] = ["p1"]
        df["CODE"] = ["c1"]
        df["CODE_TYPE"] = ["ICD10CM"]
        min_days = datetime.timedelta(days=90)
        one_day = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)

        df = add_flag(df, "x", ["x1", "x2"])
        df = add_flag(df, "y", ["y1", "y2"])
        df = add_flag(df, "z", ["z1", "z2"])

        df["EVENT_DATE"] = [
            index_date - one_day,
            index_date - one_day,
            index_date - one_day,
        ] + [index_date + 2 * one_day] * (df.shape[0] - 3)
        df["INDEX_DATE"] = index_date

        df["PERSON_ID"] = [f"P{i}" for i in range(df.shape[0])]

        return [{"name": "person", "df": df}]

    def define_phenotype_tests(self):
        c1 = {
            "name": "single_flag",
            "persons": [f"P{i}" for i in range(3)],
            "phenotype": CategoricalPhenotype(
                domain="person",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1"],
                    column_name="z",
                ),
                relative_time_range=RelativeTimeRangeFilter(
                    when="before", min_days=GreaterThanOrEqualTo(0)
                ),
            ),
        }

        c2 = {
            "name": "two_categorical_filter_or",
            "persons": [f"P{i}" for i in range(3)],
            "phenotype": CategoricalPhenotype(
                domain="person",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1", "y2"], column_name="z", domain="person"
                )
                | CategoricalFilter(
                    allowed_values=["y2"], column_name="y", domain="person"
                ),
                relative_time_range=RelativeTimeRangeFilter(
                    when="before", min_days=GreaterThanOrEqualTo(0)
                ),
            ),
        }

        c3 = {
            "name": "two_categorical_filter_and",
            "persons": ["P3"],
            "phenotype": CategoricalPhenotype(
                domain="person",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1"], column_name="z", domain="person"
                )
                & CategoricalFilter(
                    allowed_values=["y2"], column_name="y", domain="person"
                ),
                relative_time_range=RelativeTimeRangeFilter(
                    when="after", min_days=GreaterThanOrEqualTo(0)
                ),
            ),
        }

        test_infos = [c1, c2, c3]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


def test_categorical_phenotype():
    spg = CategoricalPhenotypeTestGenerator()
    spg.run_tests()


def test_categorical_phenotype_with_time():
    spg = CategoricalPhenotypeWithDateTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    # test_categorical_phenotype()
    test_categorical_phenotype_with_time()
