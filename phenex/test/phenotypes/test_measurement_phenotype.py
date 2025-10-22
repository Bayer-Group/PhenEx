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
from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.value_filter import ValueFilter
from phenex.filters.date_filter import DateFilter
from phenex.aggregators import *
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class MeasurementPhenotypeValueFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "mmpt_valuefilter"

    def define_input_tables(self):
        df = pd.DataFrame()
        N = 11
        df["VALUE"] = list(range(N))
        df["PERSON_ID"] = [f"P{x}" for x in range(N)]
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["EVENT_DATE"] = None
        df["flag"] = ["inpatient"] * 5 + [""] * (N - 5)
        df.iloc[-1, 0] = None  # make a null lab value for last patient
        return [{"name": "MEASUREMENT", "df": df}]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        c1 = {
            "name": "leq5",
            "persons": [f"P{x}" for x in range(6)],
            "phenotype": MeasurementPhenotype(
                name="leq5",
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_filter=ValueFilter(max_value=LessThanOrEqualTo(5)),
                return_date="all",
            ),
        }

        c2 = {
            "name": "l5",
            "persons": [f"P{x}" for x in range(5)],
            "phenotype": MeasurementPhenotype(
                name="l5",
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_filter=ValueFilter(max_value=LessThan(5)),
                return_date="all",
            ),
        }
        test_infos = [c1, c2]
        return test_infos


class MeasurementPhenotypeReturnAllValueFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "mmpt_returnallvaluefilter"
    test_values = True
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
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        c1 = {
            "name": "leq5",
            "persons": [f"P{x}" for x in range(6)],
            "values": [x for x in range(6)],
            "phenotype": MeasurementPhenotype(
                name="leq5",
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_filter=ValueFilter(max_value=LessThanOrEqualTo(5)),
                return_date="all",
            ),
        }

        c2 = {
            "name": "l5",
            "persons": [f"P{x}" for x in range(5)],
            "values": [x for x in range(5)],
            "phenotype": MeasurementPhenotype(
                name="l5",
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_filter=ValueFilter(max_value=LessThan(5)),
                return_date="all",
            ),
        }
        test_infos = [c1, c2]
        return test_infos


class MeasurementPhenotypeRelativeTimeRangeFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "mmpt_relativetimerange"
    test_values = True

    def define_input_tables(self):
        df = pd.DataFrame()
        N = 5
        df["VALUE"] = list(range(N))
        df["PERSON_ID"] = [f"P{x}" for x in range(N)]
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["EVENT_DATE"] = datetime.date(2022, 1, 1)
        # "01-01-2022", "%m-%d-%Y"

        df1 = copy.deepcopy(df)
        df1["VALUE"] = 1
        df1["EVENT_DATE"] = datetime.date(2024, 1, 1)
        # "01-01-2024", "%m-%d-%Y"
        df_final = pd.concat(
            [df, df1.iloc[:-1, :]]
        )  # remove last lab value in post period
        df_final["INDEX_DATE"] = datetime.date(2022, 1, 2)
        # "01-02-2022", "%m-%d-%Y"
        return [
            {
                "name": "MEASUREMENT",
                "df": df_final,
            }
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        c1 = {
            "name": "firstdate",
            "persons": [f"P{x}" for x in range(5)],
            "dates": [datetime.date(2022, 1, 1)] * 5,
            # datetime.strptime("01-01-2022", "%m-%d-%Y")] * 5,
            "values": list(range(5)),
            "phenotype": MeasurementPhenotype(
                name="firstdate",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
            ),
        }

        c2 = {
            "name": "after",
            "persons": [f"P{x}" for x in range(4)],
            "dates": [datetime.date(2024, 1, 1)] * 4,
            "values": [1] * 4,
            "phenotype": MeasurementPhenotype(
                name="after",
                return_date="first",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
            ),
        }

        test_infos = [c1, c2]
        return test_infos


class MeasurementPhenotypeValueDailyAggregationTestGenerator(PhenotypeTestGenerator):
    name_space = "mmpt_valueaggregation_daily"
    test_values = True
    test_date = True

    def define_input_tables(self):
        def create_copy_with_changes(df_d1_1, lab, date):
            _df = copy.deepcopy(df_d1_1)
            _df["VALUE"] = lab
            _df["EVENT_DATE"] = date
            return _df

        """
            Create a dataset with 3 persons with identical entries.
            Each person has 2 distinct measurements on four different dates.
            Two dates are prior to index and two dates are after.
            No two measurements (per person) are the same


            d1          d2                      d3          d4
            01-01-22    01-02-22        idx     12-01-22    12-02-22
            1           3                       5           3
            2           4                       6           8
                                                            10
        daily_median
            1.5         3.5                     5.5         8
        daily_mean
                                                            7

        mean_pre_index = 1+2+3+4 / 4 = 2.5
        mean_post_index = 3+5+6+8+10 / 5 = 6.4

        median_pre_index = 2.5
        median_post_index = 6


        """
        d1 = datetime.date(2022, 1, 1)  # "01-01-2022"
        d2 = datetime.date(2022, 1, 2)  # "01-02-2022"
        d3 = datetime.date(2022, 12, 1)  # "12-01-2022"
        d4 = datetime.date(2022, 12, 2)  # "12-02-2022"

        df_d1_1 = pd.DataFrame()
        self.N = 3
        df_d1_1["PERSON_ID"] = [f"P{x}" for x in range(self.N)]
        df_d1_1["CODE"] = "c1"
        df_d1_1["CODE_TYPE"] = "ICD10CM"
        df_d1_1["VALUE"] = 1
        df_d1_1["EVENT_DATE"] = d1

        df_d1_2 = create_copy_with_changes(df_d1_1, 2, d1)
        df_d2_3 = create_copy_with_changes(df_d1_1, 3, d2)
        df_d2_4 = create_copy_with_changes(df_d1_1, 4, d2)
        df_d3_5 = create_copy_with_changes(df_d1_1, 5, d3)
        df_d3_6 = create_copy_with_changes(df_d1_1, 6, d3)
        df_d4_7 = create_copy_with_changes(df_d1_1, 3, d4)
        df_d4_8 = create_copy_with_changes(df_d1_1, 8, d4)
        df_d4_9 = create_copy_with_changes(df_d1_1, 10, d4)

        df_final = pd.concat(
            [
                df_d1_1,
                df_d1_2,
                df_d2_3,
                df_d2_4,
                df_d3_5,
                df_d3_6,
                df_d4_7,
                df_d4_8,
                df_d4_9,
            ]
        )

        df_final["INDEX_DATE"] = datetime.date(2022, 1, 6)

        return [
            {
                "name": "MEASUREMENT",
                "df": df_final,
            }
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c2 = {
            "name": "nearest_prior_return_daily_mean",
            "persons": [f"P{x}" for x in range(self.N)],
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "values": [3.5] * self.N,
            "phenotype": MeasurementPhenotype(
                name="nearest_prior_return_daily_mean",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMean(),
            ),
        }

        cmed1 = {
            "name": "nearest_prior_return_daily_median",
            "persons": [f"P{x}" for x in range(self.N)],
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "values": [3.5] * self.N,
            "phenotype": MeasurementPhenotype(
                name="nearest_prior_return_daily_median",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMedian(),
            ),
        }

        c4 = {
            "name": "nearest_post_return_daily_mean",
            "persons": [f"P{x}" for x in range(self.N)],
            "dates": [datetime.datetime.strptime("12-01-2022", "%m-%d-%Y")] * self.N,
            "values": [5.5] * self.N,
            "phenotype": MeasurementPhenotype(
                name="nearest_post_return_daily_mean",
                return_date="first",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMean(),
            ),
        }

        cmed2 = {
            "name": "nearest_post_return_daily_median",
            "persons": [f"P{x}" for x in range(self.N)],
            "dates": [datetime.datetime.strptime("12-01-2022", "%m-%d-%Y")] * self.N,
            "values": [5.5] * self.N,
            "phenotype": MeasurementPhenotype(
                name="nearest_post_return_daily_median",
                return_date="first",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                return_value="first",
                value_aggregation=DailyMedian(),
            ),
        }

        c6 = {
            "name": "last_post_return_daily_mean",
            "persons": [f"P{x}" for x in range(self.N)],
            "dates": [datetime.datetime.strptime("12-02-2022", "%m-%d-%Y")] * self.N,
            "values": [7] * self.N,
            "phenotype": MeasurementPhenotype(
                name="last_post_return_daily_mean",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMean(),
            ),
        }

        cmed3 = {
            "name": "last_post_return_daily_median",
            "persons": [f"P{x}" for x in range(self.N)],
            "dates": [datetime.datetime.strptime("12-02-2022", "%m-%d-%Y")] * self.N,
            "values": [8] * self.N,
            "phenotype": MeasurementPhenotype(
                name="last_post_return_daily_median",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                return_value="last",
                value_aggregation=DailyMedian(),
            ),
        }

        c_max_daily_values_post_index = {
            "name": "postindex_return_max_daily_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [10] * self.N,
            "dates": [datetime.datetime.strptime("12-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="postindex_return_max_daily_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMax(),
                return_date="last",
            ),
        }

        c_max_daily_values_pre_index_last = {
            "name": "preindex_return_max_daily_values_last",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [4] * self.N,
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_max_daily_values_last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMax(),
                return_date="last",
            ),
        }

        c_max_daily_values_pre_index_first = {
            "name": "preindex_return_max_daily_values_first",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [2] * self.N,
            "dates": [datetime.datetime.strptime("01-01-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_max_daily_values_first",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMax(),
                return_date="first",
            ),
        }

        c_min_daily_values_post_index = {
            "name": "postindex_return_min_daily_values_first",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [5] * self.N,
            "dates": [datetime.datetime.strptime("12-01-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="postindex_return_min_daily_values_first",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMin(),
                return_date="first",
            ),
        }

        c_min_daily_values_pre_index_last = {
            "name": "preindex_return_min_daily_values_last",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [3] * self.N,
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_min_daily_values_last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMin(),
                return_date="last",
            ),
        }

        c_max_all_values_post_index = {
            "name": "postindex_return_max_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [10] * self.N,
            "dates": [datetime.datetime.strptime("12-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="postindex_return_max_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=Max(),
            ),
        }

        c_max_all_values_pre_index = {
            "name": "preindex_return_max_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [4] * self.N,
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_max_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                return_date="all",
                domain="MEASUREMENT",
                value_aggregation=Max(),
            ),
        }

        c_min_all_values_post_index = {
            "name": "postindex_return_min_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [3] * self.N,
            "dates": [datetime.datetime.strptime("12-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="postindex_return_min_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                return_date="all",
                domain="MEASUREMENT",
                value_aggregation=Min(),
            ),
        }

        c_min_all_values_pre_index = {
            "name": "preindex_return_min_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [1] * self.N,
            "dates": [datetime.datetime.strptime("01-01-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_min_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=Min(),
            ),
        }
        test_infos = [
            c2,
            c4,
            c6,
            cmed1,
            cmed2,
            cmed3,
            c_max_daily_values_post_index,
            c_max_daily_values_pre_index_last,
            c_max_daily_values_pre_index_first,
            c_min_daily_values_post_index,
            c_min_daily_values_pre_index_last,
            c_max_all_values_post_index,
            c_max_all_values_pre_index,
            c_min_all_values_post_index,
            c_min_all_values_pre_index,
        ]
        return test_infos


class MeasurementPhenotypeValueAllAggregationTestGenerator(
    MeasurementPhenotypeValueDailyAggregationTestGenerator
):
    name_space = "mmpt_valueaggregation_all"
    test_values = True
    test_date = False

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        c1 = {
            "name": "nearest_prior_return_all_values",
            "persons": [f"P{x}" for x in range(self.N)] * 2,
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")]
            * self.N
            * 2,
            "values": [3] * self.N + [4] * self.N,
            "phenotype": MeasurementPhenotype(
                name="nearest_prior_return_all_values",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
            ),
        }

        c3 = {
            "name": "nearest_post_return_all_values",
            "persons": [f"P{x}" for x in range(self.N)] * 2,
            "dates": [datetime.datetime.strptime("12-01-2022", "%m-%d-%Y")]
            * self.N
            * 2,
            "values": [5] * self.N + [6] * self.N,
            "phenotype": MeasurementPhenotype(
                name="nearest_post_return_all_values",
                return_date="first",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
            ),
        }

        c5 = {
            "name": "last_post_return_all_values",
            "persons": [f"P{x}" for x in range(self.N)] * 3,
            "dates": [datetime.datetime.strptime("12-02-2022", "%m-%d-%Y")]
            * self.N
            * 3,
            "values": [3] * self.N + [8] * self.N + [10] * self.N,
            "phenotype": MeasurementPhenotype(
                name="last_post_return_all_values",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
            ),
        }

        c_mean_all_values_pre_index = {
            "name": "preindex_return_mean_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [2.5] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_mean_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=Mean(),
            ),
        }

        c_mean_all_values_post_index = {
            "name": "postindex_return_mean_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [6.4] * self.N,
            "phenotype": MeasurementPhenotype(
                name="postindex_return_mean_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=Mean(),
            ),
        }

        c_median_all_values_pre_index = {
            "name": "preindex_return_median_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [2.5] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_median_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=Median(),
            ),
        }

        c_median_all_values_post_index = {
            "name": "postindex_return_median_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [6] * self.N,
            "phenotype": MeasurementPhenotype(
                name="postindex_return_median_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                return_value="all",
                value_aggregation=Median(),
            ),
        }

        test_infos = [
            c_mean_all_values_pre_index,
            c_mean_all_values_post_index,
            c_median_all_values_pre_index,
            c_median_all_values_post_index,
        ]
        return test_infos


class MeasurementPhenotypeValueAggregationDuplicateValuesTestGenerator(
    PhenotypeTestGenerator
):
    name_space = "mmpt_valueaggregation_duplicates"
    test_values = True
    test_date = True

    def define_input_tables(self):
        def create_copy_with_changes(df_d1_1, lab, date):
            _df = copy.deepcopy(df_d1_1)
            _df["VALUE"] = lab
            _df["EVENT_DATE"] = date
            return _df

        """
            Create a dataset with 3 persons with identical entries.
            Each person has 2 distinct measurements on four different dates.
            Two dates are prior to index and two dates are after.
            No two measurements (per person) are the same


            d1          d2                      d3          d4
            01-01-22    01-02-22        idx     12-01-22    12-02-22
            1           3                       5           3
            2           4                       6           8
                        1                                   10
        daily_median
            1.5         3                     5.5           8
        daily_mean
            1.5         8/3                   5.5           7

        mean_pre_index = 1+1+2+3+4 / 5 = 11/5

        median_pre_index = 2


        """
        d1 = datetime.date(2022, 1, 1)  # "01-01-2022"
        d2 = datetime.date(2022, 1, 2)  # "01-02-2022"

        df_d1_1 = pd.DataFrame()
        self.N = 3
        df_d1_1["PERSON_ID"] = [f"P{x}" for x in range(self.N)]
        df_d1_1["CODE"] = "c1"
        df_d1_1["CODE_TYPE"] = "ICD10CM"
        df_d1_1["VALUE"] = 1
        df_d1_1["EVENT_DATE"] = d1

        df_d1_2 = create_copy_with_changes(df_d1_1, 2, d1)
        df_d2_3 = create_copy_with_changes(df_d1_1, 3, d2)
        df_d2_4 = create_copy_with_changes(df_d1_1, 4, d2)
        df_d2_1_duplicate = create_copy_with_changes(df_d1_1, 1, d2)

        df_final = pd.concat(
            [
                df_d1_1,
                df_d1_2,
                df_d2_3,
                df_d2_4,
                df_d2_1_duplicate,
            ]
        )

        df_final["INDEX_DATE"] = datetime.date(2022, 1, 6)

        return [
            {
                "name": "MEASUREMENT",
                "df": df_final,
            }
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c2 = {
            "name": "nearest_prior_return_daily_mean",
            "persons": [f"P{x}" for x in range(self.N)],
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "values": [8 / 3] * self.N,
            "phenotype": MeasurementPhenotype(
                name="nearest_prior_return_daily_mean",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMean(),
            ),
        }

        cmed1 = {
            "name": "nearest_prior_return_daily_median",
            "persons": [f"P{x}" for x in range(self.N)],
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "values": [3] * self.N,
            "phenotype": MeasurementPhenotype(
                name="nearest_prior_return_daily_median",
                return_date="last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMedian(),
            ),
        }

        c_max_daily_values_pre_index_last = {
            "name": "preindex_return_max_daily_values_last",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [4] * self.N,
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_max_daily_values_last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMax(),
                return_date="last",
            ),
        }

        c_min_daily_values_pre_index_last = {
            "name": "preindex_return_min_daily_values_last",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [1] * self.N,
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_min_daily_values_last",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=DailyMin(),
                return_date="last",
            ),
        }

        c_max_all_values_pre_index = {
            "name": "preindex_return_max_all_values",
            "persons": [f"P{x}" for x in range(self.N)],
            "values": [4] * self.N,
            "dates": [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_max_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                return_date="all",
                domain="MEASUREMENT",
                value_aggregation=Max(),
            ),
        }

        c_min_all_values_pre_index = {
            "name": "preindex_return_min_all_values",
            "persons": [f"P{x}" for x in range(self.N)] * 2,
            "values": ([1] * self.N) * 2,
            "dates": [datetime.datetime.strptime("01-01-2022", "%m-%d-%Y")] * self.N
            + [datetime.datetime.strptime("01-02-2022", "%m-%d-%Y")] * self.N,
            "phenotype": MeasurementPhenotype(
                name="preindex_return_min_all_values",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
                codelist=codelist_factory.get_codelist("c1"),
                domain="MEASUREMENT",
                value_aggregation=Min(),
            ),
        }
        test_infos = [
            c2,
            cmed1,
            c_max_daily_values_pre_index_last,
            c_min_daily_values_pre_index_last,
            c_max_all_values_pre_index,
            c_min_all_values_pre_index,
        ]
        return test_infos


class MeasurementPhenotypeFurtherFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "mmpt_furtherfilter"
    test_values = True

    def define_input_tables(self):
        df = pd.DataFrame()
        N = 10
        df["VALUE"] = list(range(N))
        df["PERSON_ID"] = [f"P{x}" for x in range(N)]
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["EVENT_DATE"] = None
        df["flag"] = ["inpatient"] * 5 + [""] * (10 - 5)

        return [
            {
                "name": "MEASUREMENT",
                "df": df,
            }
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        phenotype_to_filter_further = MeasurementPhenotype(
            name="leq9",
            codelist=codelist_factory.get_codelist("c1"),
            domain="MEASUREMENT",
            value_filter=ValueFilter(value=9, operator="<="),
        )

        c2 = {
            "name": "further_filter_l2",
            "persons": [f"P{x}" for x in range(2)],
            "values": [x for x in range(2)],
            "phenotype": MeasurementPhenotype(
                name="further_filter_l2",
                value_filter=ValueFilter(value=2, operator="<"),
                further_value_filter_phenotype=phenotype_to_filter_further,
            ),
        }

        test_infos = [c2]
        for test_info in test_infos:
            test_info["refactor"] = True  # TODO remove once refactored
            test_info["extra_tests"] = ["unique"]

        return test_infos


def test_measurement_phenotype():
    spg = MeasurementPhenotypeValueFilterTestGenerator()
    spg.run_tests()


def test_measurement_phenotype_return_all_values():
    spg = MeasurementPhenotypeReturnAllValueFilterTestGenerator()
    spg.run_tests()


def test_measurement_phenotype_return_values():
    spg = MeasurementPhenotypeRelativeTimeRangeFilterTestGenerator()
    spg.run_tests(verbose=False)


def test_measurement_phenotype_value_daily_aggregation():
    spg = MeasurementPhenotypeValueDailyAggregationTestGenerator()
    spg.run_tests(verbose=False)


def test_measurement_phenotype_value_all_aggregation():
    spg = MeasurementPhenotypeValueAllAggregationTestGenerator()
    spg.run_tests(verbose=False)


def test_measurement_phenotype_value_aggregation_duplicate_values():
    spg = MeasurementPhenotypeValueAggregationDuplicateValuesTestGenerator()
    spg.run_tests(verbose=False)


if __name__ == "__main__":
    test_measurement_phenotype()
    test_measurement_phenotype_return_all_values()
    test_measurement_phenotype_return_values()
    test_measurement_phenotype_value_daily_aggregation()
    test_measurement_phenotype_value_all_aggregation()
    test_measurement_phenotype_value_aggregation_duplicate_values()
