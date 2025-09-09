import datetime, os
import pandas as pd

from phenex.phenotypes.age_phenotype import AgePhenotype
from phenex.phenotypes.bin_phenotype import BinPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.codelists.codelists import Codelist
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


class DiscreteBinPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "discrete_bin"
    value_datatype = str
    test_values = True

    def define_input_tables(self):
        # Use the same dummy data generation as CodelistPhenotype tests
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )

        # Modify the codes to match our test case
        # Replace the dummy codes with our diagnosis codes
        code_mapping = {
            "c1": "I21",
            "c2": "I22",
            "c3": "I23",
        }

        # Apply the mapping
        df["CODE"] = df["CODE"].map(lambda x: code_mapping.get(x, x))

        # Add some additional test data
        additional_rows = [
            {
                "PERSON_ID": "P8",
                "CODE": "E10",
                "EVENT_DATE": datetime.datetime.strptime("01-01-2022", "%m-%d-%Y"),
                "CODE_TYPE": "ICD10CM",
            },
        ]
        df_additional = pd.DataFrame(additional_rows)
        df = pd.concat([df, df_additional], ignore_index=True)

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        # Create a proper Codelist object
        diagnosis_codelist = Codelist(["I21", "I22", "I23", "E10"], "diagnosis_codes")

        # Create a CodelistPhenotype that returns codes
        diagnosis_codes = CodelistPhenotype(
            name="diagnosis_codes",
            codelist=diagnosis_codelist,
            domain="CONDITION_OCCURRENCE",
            return_value="all",
        )

        # Test discrete binning
        # Based on the dummy data generation pattern:
        # P1 has I21, I22, I23 -> when binned: "Acute MI", "Acute MI", "MI Complications"
        # P2 has I21, I22 -> when binned: "Acute MI", "Acute MI"
        # P3 has I21, I23 -> when binned: "Acute MI", "MI Complications"
        # P4 has I21 -> when binned: "Acute MI"
        # P5 has I22, I23 -> when binned: "Acute MI", "MI Complications"
        # P6 has I22 -> when binned: "Acute MI"
        # P7 has I23 -> when binned: "MI Complications"
        # P8 has E10 -> when binned: "Diabetes"

        # Since return_value="all", we get one row per person per code
        # We expect multiple rows for some patients
        t1 = {
            "name": "discrete_mapping",
            "persons": [
                "P1",
                "P1",
                "P1",
                "P2",
                "P2",
                "P3",
                "P3",
                "P4",
                "P5",
                "P5",
                "P6",
                "P7",
                "P8",
            ],
            "values": [
                "Acute MI",
                "Acute MI",
                "MI Complications",
                "Acute MI",
                "Acute MI",
                "Acute MI",
                "MI Complications",
                "Acute MI",
                "Acute MI",
                "MI Complications",
                "Acute MI",
                "MI Complications",
                "Diabetes",
            ],
            "phenotype": BinPhenotype(
                phenotype=diagnosis_codes,
                value_mapping={
                    "Acute MI": ["I21", "I22"],
                    "MI Complications": ["I23"],
                    "Diabetes": ["E10", "E11"],  # E11 not in data but OK in mapping
                },
            ),
        }

        test_infos = [t1]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


def test_discrete_bin_phenotype():
    spg = DiscreteBinPhenotypeTestGenerator()
    spg.run_tests()


<<<<<<< HEAD
if __name__ == "__main__":
    test_binned_age_phenotype()
    test_discrete_bin_phenotype()
=======
class DiscreteBinPhenotypeWithCodelistsTestGenerator(PhenotypeTestGenerator):
    """Test BinPhenotype with Codelist objects in value_mapping"""

    name_space = "discrete_bin_codelists"
    value_datatype = str
    test_values = True

    def define_input_tables(self):
        # Use the same dummy data generation as CodelistPhenotype tests
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )

        # Modify the codes to match our test case
        # Replace the dummy codes with our diagnosis codes
        code_mapping = {
            "c1": "I21",
            "c2": "I22",
            "c3": "I23",
        }

        # Apply the mapping
        df["CODE"] = df["CODE"].map(lambda x: code_mapping.get(x, x))

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        # Create a proper Codelist object
        diagnosis_codelist = Codelist(["I21", "I22", "I23"], "diagnosis_codes")

        # Create a CodelistPhenotype that returns codes
        diagnosis_codes = CodelistPhenotype(
            name="diagnosis_codes",
            codelist=diagnosis_codelist,
            domain="CONDITION_OCCURRENCE",
            return_value="all",
        )

        # Create Codelist objects for the bins
        acute_mi_codelist = Codelist(["I21", "I22"], "acute_mi")
        mi_complications_codelist = Codelist(["I23"], "mi_complications")

        # Test discrete binning using Codelist objects in value_mapping
        t1 = {
            "name": "discrete_mapping_with_codelists",
            "persons": [
                "P1",
                "P1",
                "P1",  # P1 has I21, I22, I23
                "P2",
                "P2",  # P2 has I21, I22
                "P3",
                "P3",  # P3 has I21, I23
                "P4",  # P4 has I21
                "P5",
                "P5",  # P5 has I22, I23
                "P6",  # P6 has I22
                "P7",  # P7 has I23
            ],
            "values": [
                "Acute MI",
                "Acute MI",
                "MI Complications",  # P1
                "Acute MI",
                "Acute MI",  # P2
                "Acute MI",
                "MI Complications",  # P3
                "Acute MI",  # P4
                "Acute MI",
                "MI Complications",  # P5
                "Acute MI",  # P6
                "MI Complications",  # P7
            ],
            "phenotype": BinPhenotype(
                phenotype=diagnosis_codes,
                value_mapping={
                    "Acute MI": acute_mi_codelist,
                    "MI Complications": mi_complications_codelist,
                },
            ),
        }

        test_infos = [t1]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


def test_discrete_bin_phenotype_with_codelists():
    spg = DiscreteBinPhenotypeWithCodelistsTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_binned_age_phenotype()
    test_discrete_bin_phenotype()
    test_discrete_bin_phenotype_with_codelists()
>>>>>>> main
