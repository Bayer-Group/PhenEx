import datetime, os
import pandas as pd

from phenex.phenotypes import CodelistPhenotype, ScorePhenotype

from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_range_filter import DateRangeFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
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
        return [
            {
                "name": "CONDITION_OCCURRENCE",
                "df": df,
            }
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
            "persons": [f"P{x}" for x in range(1, 7)],
            "values": [2, 2, 1, 1, 1, 1],
            "phenotype": ScorePhenotype(expression=(c1["phenotype"] + c2["phenotype"])),
        }

        score2 = {
            "name": "score2",
            "persons": [f"P{x}" for x in range(1, 7)],
            "values": [3, 3, 2, 2, 1, 1],
            "phenotype": ScorePhenotype(
                expression=(c1["phenotype"] * 2 + c2["phenotype"])
            ),
        }

        score3 = {
            "name": "score3",
            "persons": [f"P{x}" for x in range(1, 7)],
            "values": [3, 3, 1, 1, 2, 2],
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
            "persons": [f"P{x}" for x in range(1, 7)],
            "values": [3, 3, 1, 1, 2, 2],
            "phenotype": ScorePhenotype(expression=(c1["phenotype"] * c2["phenotype"])),
        }

        test_infos = [score1, score2, score3, score4, score5]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]
            test_info["phenotype"].name_phenotype = test_info["name"]

        return test_infos


def test_score_phenotype():
    tg = ScorePhenotypeTestGenerator()
    # tg.run_tests()


if __name__ == "__main__":
    test_score_phenotype()
