import datetime, os
import pandas as pd
import copy

from phenex.filters.value import (
    GreaterThan,
    GreaterThanOrEqualTo,
    LessThan,
    LessThanOrEqualTo,
)
from phenex.phenotypes.measurement_phenotype import MeasurementPhenotype
from phenex.phenotypes.further_value_filter_phenotype import FurtherValueFilterPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.value_filter import ValueFilter
from phenex.filters.date_filter import DateFilter, After, Before
from phenex.aggregators import *
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class FurtherValueFilterBasicTestGenerator(PhenotypeTestGenerator):
    """Test basic value filtering on the output of a MeasurementPhenotype."""

    name_space = "fvf_basic"
    test_values = True

    def define_input_tables(self):
        df = pd.DataFrame()
        N = 10
        df["VALUE"] = list(range(N))
        df["PERSON_ID"] = [f"P{x}" for x in range(N)]
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["EVENT_DATE"] = None

        return [
            {
                "name": "MEASUREMENT",
                "df": df,
            }
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            path=os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        source_phenotype = MeasurementPhenotype(
            name="leq9",
            codelist=codelist_factory.get_codelist("c1"),
            domain="MEASUREMENT",
            value_filter=ValueFilter(max_value=LessThanOrEqualTo(9)),
        )

        c1 = {
            "name": "further_filter_l2",
            "persons": [f"P{x}" for x in range(2)],
            "values": [x for x in range(2)],
            "phenotype": FurtherValueFilterPhenotype(
                name="further_filter_l2",
                phenotype=source_phenotype,
                value_filter=ValueFilter(max_value=LessThan(2)),
            ),
        }

        c2 = {
            "name": "further_filter_geq3_leq6",
            "persons": [f"P{x}" for x in range(3, 7)],
            "values": [x for x in range(3, 7)],
            "phenotype": FurtherValueFilterPhenotype(
                name="further_filter_geq3_leq6",
                phenotype=source_phenotype,
                value_filter=ValueFilter(
                    min_value=GreaterThanOrEqualTo(3),
                    max_value=LessThanOrEqualTo(6),
                ),
            ),
        }

        test_infos = [c1, c2]
        return test_infos


class FurtherValueFilterAggregationTestGenerator(PhenotypeTestGenerator):
    """Test value aggregation on the output of a MeasurementPhenotype."""

    name_space = "fvf_aggregation"
    test_values = True

    def define_input_tables(self):
        def create_copy_with_changes(df, lab, date):
            _df = copy.deepcopy(df)
            _df["VALUE"] = lab
            _df["EVENT_DATE"] = date
            return _df

        d1 = datetime.date(2022, 1, 1)
        d2 = datetime.date(2022, 1, 2)

        df_base = pd.DataFrame()
        self.N = 3
        df_base["PERSON_ID"] = [f"P{x}" for x in range(self.N)]
        df_base["CODE"] = "c1"
        df_base["CODE_TYPE"] = "ICD10CM"
        df_base["VALUE"] = 2
        df_base["EVENT_DATE"] = d1

        # d1: values 2, 4   d2: values 6, 8
        df_d1_2 = create_copy_with_changes(df_base, 4, d1)
        df_d2_1 = create_copy_with_changes(df_base, 6, d2)
        df_d2_2 = create_copy_with_changes(df_base, 8, d2)

        df_final = pd.concat([df_base, df_d1_2, df_d2_1, df_d2_2])
        df_final["INDEX_DATE"] = datetime.date(2022, 1, 3)

        return [
            {
                "name": "MEASUREMENT",
                "df": df_final,
            }
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            path=os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        source_phenotype = MeasurementPhenotype(
            name="all_values",
            codelist=codelist_factory.get_codelist("c1"),
            domain="MEASUREMENT",
        )

        # Mean of all values: (2+4+6+8)/4 = 5.0
        c_mean = {
            "name": "further_mean",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [5.0] * self.N,
            "phenotype": FurtherValueFilterPhenotype(
                name="further_mean",
                phenotype=source_phenotype,
                value_aggregation=Mean(),
            ),
        }

        # Max of all values: 8
        c_max = {
            "name": "further_max",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [8] * self.N,
            "phenotype": FurtherValueFilterPhenotype(
                name="further_max",
                phenotype=source_phenotype,
                value_aggregation=Max(),
            ),
        }

        # Min of all values: 2
        c_min = {
            "name": "further_min",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [2] * self.N,
            "phenotype": FurtherValueFilterPhenotype(
                name="further_min",
                phenotype=source_phenotype,
                value_aggregation=Min(),
            ),
        }

        # DailyMean then filter > 5: d1 mean=3, d2 mean=7 → only d2 mean=7 passes
        c_daily_mean_then_filter = {
            "name": "further_daily_mean_gt5",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [7.0] * self.N,
            "phenotype": FurtherValueFilterPhenotype(
                name="further_daily_mean_gt5",
                phenotype=source_phenotype,
                value_aggregation=DailyMean(),
                value_filter=ValueFilter(min_value=GreaterThan(5)),
            ),
        }

        test_infos = [c_mean, c_max, c_min, c_daily_mean_then_filter]
        return test_infos


class FurtherValueFilterDateRangeTestGenerator(PhenotypeTestGenerator):
    """Test date_range filtering on the output of a MeasurementPhenotype."""

    name_space = "fvf_daterange"
    test_values = True

    def define_input_tables(self):
        d1 = datetime.date(2022, 1, 1)
        d2 = datetime.date(2022, 6, 1)
        d3 = datetime.date(2022, 12, 1)

        df = pd.DataFrame()
        N = 3
        df["PERSON_ID"] = [f"P{x}" for x in range(N)]
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["VALUE"] = [10, 20, 30]
        df["EVENT_DATE"] = [d1, d2, d3]

        return [
            {
                "name": "MEASUREMENT",
                "df": df,
            }
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            path=os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        source_phenotype = MeasurementPhenotype(
            name="all_measurements",
            codelist=codelist_factory.get_codelist("c1"),
            domain="MEASUREMENT",
        )

        # Filter to only events after 2022-03-01 → P1 (June) and P2 (Dec)
        c1 = {
            "name": "after_march",
            "persons": ["P1", "P2"],
            "values": [20, 30],
            "phenotype": FurtherValueFilterPhenotype(
                name="after_march",
                phenotype=source_phenotype,
                date_range=DateFilter(min_date=After("2022-03-01")),
            ),
        }

        # Filter to only events before 2022-07-01 → P0 (Jan) and P1 (June)
        c2 = {
            "name": "before_july",
            "persons": ["P0", "P1"],
            "values": [10, 20],
            "phenotype": FurtherValueFilterPhenotype(
                name="before_july",
                phenotype=source_phenotype,
                date_range=DateFilter(max_date=Before("2022-07-01")),
            ),
        }

        # Date range + value filter: after March AND value > 25 → only P2 (Dec, value=30)
        c3 = {
            "name": "after_march_gt25",
            "persons": ["P2"],
            "values": [30],
            "phenotype": FurtherValueFilterPhenotype(
                name="after_march_gt25",
                phenotype=source_phenotype,
                date_range=DateFilter(min_date=After("2022-03-01")),
                value_filter=ValueFilter(min_value=GreaterThan(25)),
            ),
        }

        test_infos = [c1, c2, c3]
        return test_infos


class FurtherValueFilterReturnDateTestGenerator(PhenotypeTestGenerator):
    """Test return_date selection on the output of a MeasurementPhenotype."""

    name_space = "fvf_returndate"
    test_values = True
    test_date = True

    def define_input_tables(self):
        d1 = datetime.date(2022, 1, 1)
        d2 = datetime.date(2022, 6, 1)
        d3 = datetime.date(2022, 12, 1)

        df = pd.DataFrame()
        N = 3
        # Each person has 3 measurements on 3 different dates
        df["PERSON_ID"] = [f"P{x}" for x in range(N)] * 3
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["VALUE"] = [10, 20, 30] + [40, 50, 60] + [70, 80, 90]
        df["EVENT_DATE"] = [d1] * N + [d2] * N + [d3] * N

        return [
            {
                "name": "MEASUREMENT",
                "df": df,
            }
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            path=os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        source_phenotype = MeasurementPhenotype(
            name="all_values",
            codelist=codelist_factory.get_codelist("c1"),
            domain="MEASUREMENT",
        )

        # return_date='first' → earliest date for each person
        c_first = {
            "name": "return_first",
            "persons": [f"P{x}" for x in range(3)],
            "dates": [datetime.date(2022, 1, 1)] * 3,
            "values": [10, 20, 30],
            "phenotype": FurtherValueFilterPhenotype(
                name="return_first",
                phenotype=source_phenotype,
                return_date="first",
            ),
        }

        # return_date='last' → latest date for each person
        c_last = {
            "name": "return_last",
            "persons": [f"P{x}" for x in range(3)],
            "dates": [datetime.date(2022, 12, 1)] * 3,
            "values": [70, 80, 90],
            "phenotype": FurtherValueFilterPhenotype(
                name="return_last",
                phenotype=source_phenotype,
                return_date="last",
            ),
        }

        test_infos = [c_first, c_last]
        return test_infos


def test_further_value_filter_basic():
    spg = FurtherValueFilterBasicTestGenerator()
    spg.run_tests()


def test_further_value_filter_aggregation():
    spg = FurtherValueFilterAggregationTestGenerator()
    spg.run_tests()


def test_further_value_filter_date_range():
    spg = FurtherValueFilterDateRangeTestGenerator()
    spg.run_tests()


def test_further_value_filter_return_date():
    spg = FurtherValueFilterReturnDateTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_further_value_filter_basic()
    test_further_value_filter_aggregation()
    test_further_value_filter_date_range()
    test_further_value_filter_return_date()
