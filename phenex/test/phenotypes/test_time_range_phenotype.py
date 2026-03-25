import datetime, os
import pandas as pd

from phenex.filters.date_filter import After
from phenex.phenotypes.time_range_phenotype import TimeRangePhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.filters import ValueFilter, RelativeTimeRangeFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters import DateFilter, AfterOrOn, BeforeOrOn
from phenex.filters.value import *


class TimeRangePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "ccpt"
    test_values = True

    def define_input_tables(self):
        oneday = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)

        observation_period_min = 90 * oneday
        possible_start_dates = [
            index_date - 4 * observation_period_min,
            index_date - 2 * observation_period_min,
            index_date - observation_period_min - oneday,
            index_date - observation_period_min,
            index_date - observation_period_min + oneday,
            index_date,
            index_date + oneday,
        ]

        intervals = [
            observation_period_min,
            observation_period_min - oneday,
            observation_period_min + oneday,
            2 * observation_period_min,
        ]

        start_dates = []
        end_dates = []
        for s in possible_start_dates:
            for i in intervals:
                start_dates.append(s)
                end_dates.append(s + i)

        N = len(end_dates)
        df_observation_period = pd.DataFrame()
        df_observation_period["PERSON_ID"] = [f"P{x}" for x in list(range(N))]
        df_observation_period["INDEX_DATE"] = index_date
        df_observation_period["START_DATE"] = start_dates
        df_observation_period["END_DATE"] = end_dates

        df_observation_period["start_from_end"] = [
            x - y for x, y in zip(end_dates, start_dates)
        ]
        df_observation_period["start_from_index"] = [index_date - x for x in end_dates]
        df_observation_period["end_from_index"] = [index_date - x for x in start_dates]

        self.df_input = df_observation_period
        input_info_observation_period = {
            "name": "OBSERVATION_PERIOD",
            "df": df_observation_period,
        }

        return [input_info_observation_period]

    def define_phenotype_tests(self):
        t1 = {
            "name": "coverage_min_geq_90",
            "coverage_period_min": Value(value=90, operator=">="),
            "persons": ["P7", "P10", "P11", "P12", "P14", "P15"],
            "values": [180, 91, 91, 90, 90, 90],
        }
        t2 = {
            "name": "coverage_min_gt_90",
            "coverage_period_min": Value(value=90, operator=">"),
            "persons": ["P7", "P10", "P11"],
            "values": [180, 91, 91],
        }
        test_infos = [t1, t2]

        for test_info in test_infos:
            test_info["phenotype"] = TimeRangePhenotype(
                name=test_info["name"],
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=test_info.get("coverage_period_min")
                ),
            )

        return test_infos


class ContinuousCoverageReturnLastPhenotypeTestGenerator(
    TimeRangePhenotypeTestGenerator
):
    name_space = "ccpt_returnlast"
    test_date = True

    def define_phenotype_tests(self):
        persons = ["P15", "P19", "P20", "P22", "P23"]

        t1 = {
            "name": "coverage_min_geq_90",
            "coverage_period_min": Value(value=90, operator=">="),
            "persons": persons,
            "values": [90, 91, 90, 91, 180],
            "dates": list(
                self.df_input[self.df_input["PERSON_ID"].isin(persons)][
                    "END_DATE"
                ].values
            ),
        }

        persons = ["P19", "P22", "P23"]
        t2 = {
            "name": "coverage_min_gt_90",
            "coverage_period_min": Value(value=90, operator=">"),
            "persons": persons,
            "values": [91, 91, 180],
            "dates": list(
                self.df_input[self.df_input["PERSON_ID"].isin(persons)][
                    "END_DATE"
                ].values
            ),
        }
        test_infos = [t1, t2]

        for test_info in test_infos:
            test_info["phenotype"] = TimeRangePhenotype(
                name=test_info["name"],
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=test_info.get("coverage_period_min"), when="after"
                ),
            )

        return test_infos


class ContinuousCoverageWithAnchorPhenotype(TimeRangePhenotypeTestGenerator):
    name_space = "ccpt_anchorphenotype"

    def define_input_tables(self):
        tables = super().define_input_tables()

        tables[0]["df"].drop(columns=["INDEX_DATE"], inplace=True)
        df = pd.DataFrame()
        n_patients = tables[0]["df"]["PERSON_ID"].unique().shape[0]
        c1s = ["c1"] * 12
        df["CODE"] = c1s + ["c2"] * (n_patients - len(c1s))
        df["CODE_TYPE"] = "ICD10"
        df["EVENT_DATE"] = datetime.date(2022, 1, 1)
        df["PERSON_ID"] = ["P" + str(x) for x in range(n_patients)]
        tables.append({"name": "CONDITION_OCCURRENCE", "df": df})
        return tables

    def define_phenotype_tests(self):
        entry = CodelistPhenotype(
            name="entry",
            codelist=Codelist(name="c1", codelist={"ICD10": ["c1"]}),
            domain="CONDITION_OCCURRENCE",
        )

        cc1 = TimeRangePhenotype(
            name="cc_prior_entry",
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(90), when="before", anchor_phenotype=entry
            ),
        )

        persons = ["P7", "P10", "P11"]

        t1 = {
            "name": "coverage_min_geq_90",
            "persons": persons,
            "values": [180, 91, 91],
            "phenotype": cc1,
        }

        test_infos = [t1]
        return test_infos


def test_time_range_phenotypes():
    spg = TimeRangePhenotypeTestGenerator()
    spg.run_tests()


def test_continuous_coverage_return_last():
    spg = ContinuousCoverageReturnLastPhenotypeTestGenerator()
    spg.run_tests()


def test_continuous_coverage_with_anchor_phenotype():
    spg = ContinuousCoverageWithAnchorPhenotype()
    spg.run_tests()


class TimeRangePhenotypeWithDateRangeBeforeAllExcludedTestGenerator(
    TimeRangePhenotypeTestGenerator
):
    """
    Tests that min_date AFTER the index date excludes ALL patients.

    AfterOrOn("2022-01-02") clips START_DATE to 2022-01-02, which is strictly
    after INDEX_DATE (2022-01-01). The anchor-containment filter requires
    START_DATE <= INDEX_DATE, so every patient is excluded.
    """

    name_space = "ccpt_daterange_before_all_excluded"
    test_values = False

    def define_phenotype_tests(self):
        t1 = {
            "name": "min_date_after_index_excludes_all",
            "persons": [],
        }

        for test_info in [t1]:
            test_info["phenotype"] = TimeRangePhenotype(
                name=test_info["name"],
                relative_time_range=RelativeTimeRangeFilter(when="before"),
                date_range=DateFilter(min_date=AfterOrOn("2022-01-02")),
            )

        return [t1]


class TimeRangePhenotypeWithDateRangeBeforeReducedDaysTestGenerator(
    TimeRangePhenotypeTestGenerator
):
    """
    Tests that min_date before the index date clips START_DATE, excludes patients
    whose entire period precedes the clipped start, and reduces VALUE (coverage
    days) for the remaining patients.

    AfterOrOn("2021-11-01") clips START_DATE to max(original, 2021-11-01):
      - Patients whose original END_DATE < 2021-11-01 are excluded (clipped
        START > END): P0-P6, P8, P9, P13.
      - Patients whose END_DATE < INDEX_DATE are excluded by anchor containment.
      - Remaining patients (P7, P10-P12, P14-P23) all get VALUE = 61 days
        (2022-01-01 - 2021-11-01) except P20-P23 whose original start date
        (2022-01-01) is already >= 2021-11-01, giving VALUE = 0.
    """

    name_space = "ccpt_daterange_before_reduced_days"
    test_values = True

    def define_phenotype_tests(self):
        t1 = {
            "name": "min_date_reduces_coverage_days",
            "persons": [
                "P7",
                "P10",
                "P11",
                "P12",
                "P14",
                "P15",
                "P16",
                "P17",
                "P18",
                "P19",
                "P20",
                "P21",
                "P22",
                "P23",
            ],
            # P7 was 180 days, P10/P11 were 91, P12/P14/P15 were 90,
            # P16-P19 were 89 – all clipped to 61. P20-P23 start on INDEX_DATE -> 0.
            "values": [61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 0, 0, 0, 0],
        }

        t1["phenotype"] = TimeRangePhenotype(
            name=t1["name"],
            relative_time_range=RelativeTimeRangeFilter(when="before"),
            date_range=DateFilter(min_date=AfterOrOn("2021-11-01")),
        )

        return [t1]


class TimeRangePhenotypeWithDateRangeAfterAllExcludedTestGenerator(
    TimeRangePhenotypeTestGenerator
):
    """
    Tests that max_date BEFORE the index date excludes ALL patients.

    BeforeOrOn("2021-12-31") clips END_DATE to 2021-12-31, which is strictly
    before INDEX_DATE (2022-01-01). The anchor-containment filter requires
    INDEX_DATE <= END_DATE, so every patient is excluded.
    """

    name_space = "ccpt_daterange_after_all_excluded"
    test_values = False

    def define_phenotype_tests(self):
        t1 = {
            "name": "max_date_before_index_excludes_all",
            "persons": [],
        }

        t1["phenotype"] = TimeRangePhenotype(
            name=t1["name"],
            relative_time_range=RelativeTimeRangeFilter(when="after"),
            date_range=DateFilter(max_date=BeforeOrOn("2021-12-31")),
        )

        return [t1]


class TimeRangePhenotypeWithDateRangeAfterReducedDaysTestGenerator(
    TimeRangePhenotypeTestGenerator
):
    """
    Tests that max_date after the index date clips END_DATE, excludes patients
    whose entire period ends before INDEX_DATE, and reduces VALUE (coverage days)
    for patients whose original END_DATE exceeded the cap.

    BeforeOrOn("2022-02-15") clips END_DATE to min(original, 2022-02-15):
      - Patients with END_DATE < INDEX_DATE (P0-P6, P8, P9, P13) are excluded
        by anchor containment (END_DATE < INDEX_DATE after clipping).
      - Patients with START_DATE > INDEX_DATE (P24-P27) are excluded by
        anchor containment (START_DATE > INDEX_DATE).
      - P7/P10/P12/P17 have END_DATE = INDEX_DATE -> VALUE = 0.
      - P14/P16/P18 have END_DATE = INDEX_DATE+1/+2 -> VALUE = 1/1/2.
      - P11/P15/P19/P20/P21/P22/P23 have END_DATE > 2022-02-15 -> clipped
        to 2022-02-15 -> VALUE = 45.
    """

    name_space = "ccpt_daterange_after_reduced_days"
    test_values = True

    def define_phenotype_tests(self):
        t1 = {
            "name": "max_date_reduces_coverage_days",
            "persons": [
                "P7",
                "P10",
                "P11",
                "P12",
                "P14",
                "P15",
                "P16",
                "P17",
                "P18",
                "P19",
                "P20",
                "P21",
                "P22",
                "P23",
            ],
            "values": [0, 0, 45, 0, 1, 45, 1, 0, 2, 45, 45, 45, 45, 45],
        }

        t1["phenotype"] = TimeRangePhenotype(
            name=t1["name"],
            relative_time_range=RelativeTimeRangeFilter(when="after"),
            date_range=DateFilter(max_date=BeforeOrOn("2022-02-15")),
        )

        return [t1]


def test_time_range_phenotype_date_range_before_all_excluded():
    spg = TimeRangePhenotypeWithDateRangeBeforeAllExcludedTestGenerator()
    spg.run_tests()


def test_time_range_phenotype_date_range_before_reduced_days():
    spg = TimeRangePhenotypeWithDateRangeBeforeReducedDaysTestGenerator()
    spg.run_tests()


def test_time_range_phenotype_date_range_after_all_excluded():
    spg = TimeRangePhenotypeWithDateRangeAfterAllExcludedTestGenerator()
    spg.run_tests()


def test_time_range_phenotype_date_range_after_reduced_days():
    spg = TimeRangePhenotypeWithDateRangeAfterReducedDaysTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_time_range_phenotypes()
    test_continuous_coverage_return_last()
    test_continuous_coverage_with_anchor_phenotype()
    test_time_range_phenotype_date_range_before_all_excluded()
    test_time_range_phenotype_date_range_before_reduced_days()
    test_time_range_phenotype_date_range_after_all_excluded()
    test_time_range_phenotype_date_range_after_reduced_days()
