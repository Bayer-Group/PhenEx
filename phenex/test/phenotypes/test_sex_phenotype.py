import datetime, os
import pandas as pd

from phenex.phenotypes.sex_phenotype import SexPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_filter import DateFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.categorical_filter import CategoricalFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class SexPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "sxpt"
    value_datatype = str

    def define_input_tables(self):
        self.n_persons = 6
        N = self.n_persons

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = [f"P{x}" for x in list(range(N))]
        df_person["SEX"] = [
            "Male",
            "Female",
            "Male",
            "Male",
            "Female",
            "Unknown",
        ]

        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }

        return [input_info_person]

    def define_phenotype_tests(self):
        all_sexes = {
            "name": "all_sexes",
            "allowed_values": None,
            "persons": ["P0", "P1", "P2", "P3", "P4", "P5"],
            "values": ["Male", "Female", "Male", "Male", "Female", "Unknown"],
        }

        male = {
            "name": "sex_male",
            "allowed_values": ["Male"],
            "persons": ["P0", "P2", "P3"],
            "values": ["Male"] * 3,
        }

        female = {
            "name": "sex_female",
            "allowed_values": ["Female"],
            "persons": ["P1", "P4"],
            "values": ["Female"] * 2,
        }

        known = {
            "name": "sex_known",
            "allowed_values": ["Male", "Female"],
            "persons": ["P0", "P1", "P2", "P3", "P4"],
            "values": ["Male", "Female", "Male", "Male", "Female"],
        }

        test_infos = [all_sexes, male, female, known]

        for test_info in test_infos:
            test_info["phenotype"] = SexPhenotype(
                name=test_info["name"],
                domain="PERSON",
                categorical_filter=CategoricalFilter(allowed_values =test_info.get("allowed_values")),
            )

        return test_infos


def test_sex_phenotype():
    spg = SexPhenotypeTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_sex_phenotype()
