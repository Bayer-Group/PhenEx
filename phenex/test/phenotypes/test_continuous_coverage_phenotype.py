import datetime, os
import pandas as pd

from phenex.phenotypes.continuous_coverage_phenotype import ContinuousCoveragePhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import LocalCSVCodelistFactory, Codelist
from phenex.filters.date_filter import DateFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class ContinuousCoveragePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "ccpt"

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
        df_observation_period["OBSERVATION_PERIOD_START_DATE"] = start_dates
        df_observation_period["OBSERVATION_PERIOD_END_DATE"] = end_dates

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
        }
        t2 = {
            "name": "coverage_min_gt_90",
            "coverage_period_min": Value(value=90, operator=">"),
            "persons": ["P7", "P10", "P11"],
        }
        test_infos = [t1, t2]

        for test_info in test_infos:
            test_info["phenotype"] = ContinuousCoveragePhenotype(
                name=test_info["name"],
                min_days=test_info.get("coverage_period_min"),
            )

        return test_infos


class ContinuousCoverageReturnLastPhenotypeTestGenerator(
    ContinuousCoveragePhenotypeTestGenerator
):
    name_space = "ccpt_returnlast"
    test_date = True

    def define_phenotype_tests(self):
        persons = ["P15", "P19", "P20", "P22", "P23"]

        t1 = {
            "name": "coverage_min_geq_90",
            "coverage_period_min": Value(value=90, operator=">="),
            "persons": persons,
            "dates": list(
                self.df_input[self.df_input["PERSON_ID"].isin(persons)][
                    "OBSERVATION_PERIOD_END_DATE"
                ].values
            ),
        }

        persons = ["P19", "P22", "P23"]
        t2 = {
            "name": "coverage_min_gt_90",
            "coverage_period_min": Value(value=90, operator=">"),
            "persons": persons,
            "dates": list(
                self.df_input[self.df_input["PERSON_ID"].isin(persons)][
                    "OBSERVATION_PERIOD_END_DATE"
                ].values
            ),
        }
        test_infos = [t1, t2]

        for test_info in test_infos:
            test_info["phenotype"] = ContinuousCoveragePhenotype(
                name=test_info["name"],
                min_days=test_info.get("coverage_period_min"),
                when="after",
            )

        return test_infos


class ContinuousCoverageWithAnchorPhenotype(ContinuousCoveragePhenotypeTestGenerator):
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

        cc1 = ContinuousCoveragePhenotype(
            name="cc_prior_entry",
            min_days=GreaterThanOrEqualTo(90),
            when="before",
            anchor_phenotype=entry,
        )

        persons = ["P7", "P10", "P11"]

        t1 = {
            "name": "coverage_min_geq_90",
            "persons": persons,
            "phenotype": cc1,
        }

        test_infos = [t1]
        return test_infos


def test_continuous_coverage_phenotypes():
    spg = ContinuousCoveragePhenotypeTestGenerator()
    spg.run_tests()


def test_continuous_coverage_return_last():
    spg = ContinuousCoverageReturnLastPhenotypeTestGenerator()
    spg.run_tests()


def test_continuous_coverage_with_anchor_phenotype():
    spg = ContinuousCoverageWithAnchorPhenotype()
    spg.run_tests()


if __name__ == "__main__":
    test_continuous_coverage_phenotypes()
    test_continuous_coverage_return_last()
    test_continuous_coverage_with_anchor_phenotype()
