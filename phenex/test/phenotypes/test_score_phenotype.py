import datetime, os
import pandas as pd

from phenex.phenotypes import CodelistPhenotype, ScorePhenotype

from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_filter import DateFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.value_filter import ValueFilter
from phenex.filters.value import GreaterThanOrEqualTo, LessThan
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class ScorePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "scpt"
    test_values = True

    def define_input_tables(self):
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = df["PERSON_ID"].unique()
        return [
            {
                "name": "CONDITION_OCCURRENCE",
                "df": df,
            },
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c1 = {
            "name": "c1",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="CONDITION_OCCURRENCE",
            ),
        }

        c2 = {
            "name": "c2",
            "persons": ["P1", "P2", "P5", "P6"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c2"),
                domain="CONDITION_OCCURRENCE",
            ),
        }

        c3 = {
            "name": "c3",
            "persons": ["P1", "P3", "P5", "P7"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c3"),
                domain="CONDITION_OCCURRENCE",
            ),
        }

        score1 = {
            "name": "score1",
            "persons": [f"P{x}" for x in range(1, 8)],
            "values": [2, 2, 1, 1, 1, 1, 0],
            "phenotype": ScorePhenotype(expression=(c1["phenotype"] + c2["phenotype"])),
        }

        score2 = {
            "name": "score2",
            "persons": [f"P{x}" for x in range(1, 8)],
            "values": [3, 3, 2, 2, 1, 1, 0],
            "phenotype": ScorePhenotype(
                expression=(c1["phenotype"] * 2 + c2["phenotype"])
            ),
        }

        score3 = {
            "name": "score3",
            "persons": [f"P{x}" for x in range(1, 8)],
            "values": [3, 3, 1, 1, 2, 2, 0],
            "phenotype": ScorePhenotype(
                expression=(c1["phenotype"] + c2["phenotype"] * 2)
            ),
        }

        score4 = {
            "name": "score4",
            "persons": [f"P{x}" for x in range(1, 8)],
            "values": [3, 2, 2, 1, 2, 1, 1],
            "phenotype": ScorePhenotype(
                expression=(c1["phenotype"] + c2["phenotype"] + c3["phenotype"])
            ),
        }

        score5 = {
            "name": "score5",
            "persons": [f"P{x}" for x in range(1, 8)],
            "values": [4, 3, 3, 2, 2, 1, 1],
            "phenotype": ScorePhenotype(
                expression=(c1["phenotype"] * 2 + c2["phenotype"] + c3["phenotype"])
            ),
        }

        score6 = {
            "name": "score6",
            "persons": [f"P{x}" for x in range(1, 8)],
            "values": [3, 3, 1, 1, 2, 2, 0],
            "phenotype": ScorePhenotype(expression=(c1["phenotype"] * c2["phenotype"])),
        }

        test_infos = [score1, score2, score3, score4, score5]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]
            test_info["phenotype"].name_phenotype = test_info["name"]

        return test_infos


def test_score_phenotype():
    tg = ScorePhenotypeTestGenerator()
    tg.run_tests()


class ScorePhenotypeValueFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "scptvf"
    test_values = True

    def define_input_tables(self):
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = df["PERSON_ID"].unique()
        return [
            {
                "name": "CONDITION_OCCURRENCE",
                "df": df,
            },
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c1 = CodelistPhenotype(
            codelist=codelist_factory.get_codelist("c1"),
            domain="CONDITION_OCCURRENCE",
        )

        c2 = CodelistPhenotype(
            codelist=codelist_factory.get_codelist("c2"),
            domain="CONDITION_OCCURRENCE",
        )

        c3 = CodelistPhenotype(
            codelist=codelist_factory.get_codelist("c3"),
            domain="CONDITION_OCCURRENCE",
        )

        # Base score without filter: c1 + c2 + c3
        # Expected: P1=3, P2=2, P3=2, P4=1, P5=2, P6=1, P7=1
        base_score = ScorePhenotype(
            expression=(c1 + c2 + c3),
            name="base_score",
        )

        # Filter for scores >= 2 (P1, P2, P3, P5)
        score_gte_2 = {
            "name": "score_gte_2",
            "persons": ["P1", "P2", "P3", "P5"],
            "values": [3, 2, 2, 2],
            "phenotype": ScorePhenotype(
                expression=(c1 + c2 + c3),
                value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(2)),
            ),
        }

        # Filter for scores < 2 (P4, P6, P7)
        score_lt_2 = {
            "name": "score_lt_2",
            "persons": ["P4", "P6", "P7"],
            "values": [1, 1, 1],
            "phenotype": ScorePhenotype(
                expression=(c1 + c2 + c3),
                value_filter=ValueFilter(max_value=LessThan(2)),
            ),
        }

        # Filter for scores >= 2 AND < 3 (P2, P3, P5)
        score_2 = {
            "name": "score_2",
            "persons": ["P2", "P3", "P5"],
            "values": [2, 2, 2],
            "phenotype": ScorePhenotype(
                expression=(c1 + c2 + c3),
                value_filter=ValueFilter(
                    min_value=GreaterThanOrEqualTo(2), max_value=LessThan(3)
                ),
            ),
        }

        test_infos = [score_gte_2, score_lt_2, score_2]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]
            test_info["phenotype"].name_phenotype = test_info["name"]

        return test_infos


def test_score_phenotype_value_filter():
    tg = ScorePhenotypeValueFilterTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_score_phenotype()
    test_score_phenotype_value_filter()
