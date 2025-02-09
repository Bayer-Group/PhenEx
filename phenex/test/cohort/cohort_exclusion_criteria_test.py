import datetime, os
import pandas as pd
import ibis
from phenex.test.cohort_test_generator import CohortTestGenerator
from phenex.codelists import Codelist
from phenex.phenotypes import (
    AgePhenotype,
    CategoricalPhenotype,
    CodelistPhenotype,
    Cohort,
    ContinuousCoveragePhenotype,
    SexPhenotype,
)
from phenex.filters import (
    DateRangeFilter,
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    GreaterThan,
)
from phenex.test.cohort.test_mappings import TestPersonTable, TestDrugExposureTable, TestObservationPeriodTable, TestConditionOccurenceTable

from phenex.test.util.dummy.generate_dummy_cohort_data import generate_dummy_cohort_data

def create_cohort():
    entry = CodelistPhenotype(
        return_date="first",
        codelist=Codelist(["d1"]).resolve(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )
    inclusion, exclusion = define_inclusion_exclusion_criteria(entry)
    cohort = Cohort(
        name="test_cohort_exclusion",
        entry_criterion=entry,
        inclusions=inclusion,
        exclusions=exclusion,
    )
    return cohort


def define_inclusion_exclusion_criteria(entry):

    inclusion_criteria = []

    e4 = CodelistPhenotype(
        name="prior_et_usage",
        codelist=Codelist(["e4"]).resolve(use_code_type=False),
        domain="DRUG_EXPOSURE",
        relative_time_range=RelativeTimeRangeFilter(when='before', min_days=GreaterThanOrEqualTo(0))
    )
    exclusion_criteria = [e4]

    return inclusion_criteria, exclusion_criteria


class SimpleCohortTestGenerator(CohortTestGenerator):
    def __init__(self, df_all_test_data, expected_waterfall, expected_index):
        """
        
        """
        self.df_all_test_data = df_all_test_data
        self.expected_waterfall = expected_waterfall
        self.expected_index = expected_index
        super().__init__()

    def define_cohort(self):
        return create_cohort()

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.df_all_test_data

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID"]])
        df_person["YOB"] = 1
        df_person["GENDER"] = 1
        df_person["ACCEPTABLE"] = 1
        schema_person = {"PATID": str, "YOB": int, "GENDER": int, "ACCEPTABLE": int}
        person_table = TestPersonTable(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )
        # create drug exposure table
        df_drug_exposure_entry = pd.DataFrame(df_allvalues[["PATID", "entry", "entry_date"]])
        df_drug_exclusion_exposure = pd.DataFrame(df_allvalues[["PATID", "prior_et_use", "prior_et_use_date"]])
        print(df_allvalues[(df_allvalues['entry']=='d1')&(df_allvalues['prior_et_use']!='e4')])
        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]

        df_drug_exposure = pd.concat([df_drug_exposure_entry, df_drug_exclusion_exposure])
        df_allvalues.to_csv('/Users/ahartens/Desktop/test.csv',index=False)

        df_drug_exposure.to_csv('/Users/ahartens/Desktop/test_drugexposure.csv',index=False)
        schema_drug_exposure = {
            "PATID": str,
            "PRODCODEID": str,
            "ISSUEDATE": datetime.date,
        }
        drug_exposure_table = TestDrugExposureTable(
            self.con.create_table(
                "DRUG_EXPOSURE", df_drug_exposure, schema=schema_drug_exposure
            )
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
        }

    def define_expected_output(self):
        df_counts_inclusion = pd.DataFrame()
        df_counts_inclusion["phenotype"] = [
            "breast_cancer",
            "continuous_coverage",
            "data_quality",
            "age",
            "sex",
        ]
        df_counts_inclusion["n"] = [16, 32, 32, 32, 32]

        df_counts_exclusion = pd.DataFrame()
        df_counts_exclusion["phenotype"] = ["prior_et_usage"]
        df_counts_exclusion["n"] = [0]

        test_infos = {
            "counts_inclusion": df_counts_inclusion,
            "counts_exclusion": df_counts_exclusion,
        }
        return test_infos

def test_simple_cohort():
    inclusion = [
        {
            "name": "entry",
            "values": ["d1", "d4"],
        },  # the first value is the allowed value, the second is the not allowed value
        {
            "name": "entry_date",
            "values": [datetime.date(2020, 1, 1)],
        },  # first da
        {"name":"prior_et_use", "values":['e1','e4']}, # will exclude e4 patients in second time range...
        {
            "name": "prior_et_use_date",
            "values": [datetime.date(2019, 4, 1)],
        },
    ]
    df = generate_dummy_cohort_data(inclusion)
    cprd_study = SimpleCohortTestGenerator(df)
    cprd_study.run_tests()


if __name__ == "__main__":
    test_simple_cohort()
