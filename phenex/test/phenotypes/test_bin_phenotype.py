import datetime, os
import pandas as pd

from phenex.phenotypes.age_phenotype import AgePhenotype
from phenex.phenotypes.bin_phenotype import BinPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_filter import DateFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters import Value, ValueFilter

from phenex.mappers import *


class BinnedAgePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "bnpt_age"
    value_datatype = str
    test_values = True

    def define_input_tables(self):
        index_date = datetime.date(2022, 1, 1)

        self.n_persons = int(20 / 5) + 1

        birth_dates = [
            index_date - datetime.timedelta(days=365.25 * i * 5)
            for i in range(self.n_persons)
        ]
        N = len(birth_dates)

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = [f"P{x}" for x in list(range(N))]
        df_person["DATE_OF_BIRTH"] = birth_dates
        df_person["INDEX_DATE"] = index_date

        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }

        return [input_info_person]

    def define_phenotype_tests(self):
        agept = AgePhenotype()
        ages_matching = list(range(self.n_persons))
        t1 = {
            "name": "bins",
            "persons": [f"P{x}" for x in ages_matching],
            "values": ["[0-10)", "[0-10)", "[10-20)", "[10-20)", "[20-30)"],
            "phenotype": BinPhenotype(
                phenotype=agept,
            ),
        }

        t2 = {
            "name": "bins_out_of_range",
            "persons": [f"P{x}" for x in ages_matching],
            "values": ["<10", "<10", "[10-20)", "[10-20)", ">=20"],
            "phenotype": BinPhenotype(phenotype=agept, bins=[10, 20]),
        }
        test_infos = [t1, t2]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


def test_binned_age_phenotype():
    spg = BinnedAgePhenotypeTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_binned_age_phenotype()
