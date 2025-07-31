
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

from .test_age_phenotype import AgePhenotypeTestGenerator

class BinnedAgePhenotypeTestGenerator(AgePhenotypeTestGenerator):
    name_space = "bnpt_age"

    def define_phenotype_tests(self):
        agept = AgePhenotype()
        ages_matching = list(range(self.n_persons))
        t1 = {
            "name": "bins",
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
            "phenotype": BinPhenotype(
                phenotype=agept,
            )
        }
        test_infos = [
            t1
        ]
       
        for test_info in test_infos:
            test_info["phenotype"].name = test_info['name']

        return test_infos

def test_binned_age_phenotype():
    spg = BinnedAgePhenotypeTestGenerator()
    spg.run_tests()

if __name__ == "__main__":
    test_binned_age_phenotype()
