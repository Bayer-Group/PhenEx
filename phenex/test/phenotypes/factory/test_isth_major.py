import datetime, os
import pandas as pd
import ibis
from phenex.test.cohort_test_generator import CohortTestGenerator
from phenex.codelists import Codelist
from phenex.phenotypes.factory.isth_major_bleeding import (
    ISTHMajorBleedingPhenotype, ISTHBleedComponents
)

from phenex.filters import (
    DateRangeFilter,
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    GreaterThan,
    CategoricalFilter
)
from phenex.test.cohort.test_mappings import (
    PersonTableForTests,
    DrugExposureTableForTests,
    ObservationPeriodTableForTests,
    ConditionOccurenceTableForTests,
)

from phenex.test.util.dummy.generate_dummy_cohort_data import generate_dummy_cohort_data


class ISTHTestGenerator(CohortTestGenerator):
    def define_cohort(self):

        c = ISTHBleedComponents(
            critical_organ_bleed_codelist=Codelist(["d1"]).resolve(ignore_code_type=True),
            overt_bleed_codelist=Codelist(["d2"]).resolve(ignore_code_type=True),
            possible_bleed_codelist=Codelist(["d3"]).resolve(ignore_code_type=True),
            inpatient=CategoricalFilter(column="ENCOUNTER_TYPE", allowed_values=['inpatient'], domain="VISIT_OCCURRENCE"),
            outpatient=CategoricalFilter(column="ENCOUNTER_TYPE", allowed_values=['outpatient'], domain="VISIT_OCCURRENCE"),
            primary_diagnosis=CategoricalFilter(column="DIAGNOSIS_POSITION", allowed_values=[1], domain="CONDITION_OCCURRENCE"),
            secondary_diagnosis=~CategoricalFilter(column="DIAGNOSIS_POSITION", allowed_values=[1], domain="CONDITION_OCCURRENCE"),
            diagnosis_of = CategoricalFilter(column="STATUS", allowed_values=['DIAGNOSIS_OF'], domain="CONDITION_OCCURRENCE"),
            diagnosis_code_domain = 'CONDITION_OCCURRENCE_SOURCE',
            procedure_code_domain = 'PROCEDURE_OCCURRENCE_SOURCE',
            death_domain = 'PERSON',

        )


    inpatient: CategoricalFilter
    outpatient: CategoricalFilter
    primary_diagnosis: CategoricalFilter
    secondary_diagnosis: CategoricalFilter
    diagnosis_of: CategoricalFilter = None
    diagnosis_code_domain: str = 'CONDITION_OCCURRENCE_SOURCE'
    procedure_code_domain: str = 'PROCEDURE_OCCURRENCE_SOURCE'
    death_domain: str = 'PERSON'
    anchor_phenotype: Optional[Union[str, "Phenotype"]] = None
    when: str = 'after'
        entry = ISTHMajorBleedingPhenotype(
            return_date="first",
            components=c,
        )


        return Cohort(
            name="isth_major_bleed",
            entry_criterion=entry,
        )

    def generate_dummy_input_data(self):
        values = [
            {
                "name": "entry",
                "values": ["d1", "d4"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1)],
            },
            {"name": "prior_et_use", "values": ["e1", "e4"]},
            {
                "name": "prior_et_use_date",
                "values": [datetime.date(2019, 4, 1)],
            },
        ]

        return generate_dummy_cohort_data(values)

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID"]])
        df_person["YOB"] = 1
        df_person["GENDER"] = 1
        df_person["ACCEPTABLE"] = 1
        schema_person = {"PATID": str, "YOB": int, "GENDER": int, "ACCEPTABLE": int}
        person_table = PersonTableForTests(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )
        # create drug exposure table
        df_drug_exposure_entry = pd.DataFrame(
            df_allvalues[["PATID", "entry", "entry_date"]]
        )
        df_drug_exclusion_exposure = pd.DataFrame(
            df_allvalues[["PATID", "prior_et_use", "prior_et_use_date"]]
        )
        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exposure = pd.concat(
            [df_drug_exposure_entry, df_drug_exclusion_exposure]
        )

        schema_drug_exposure = {
            "PATID": str,
            "PRODCODEID": str,
            "ISSUEDATE": datetime.date,
        }
        drug_exposure_table = DrugExposureTableForTests(
            self.con.create_table(
                "DRUG_EXPOSURE", df_drug_exposure, schema=schema_drug_exposure
            )
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
        }

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


def test_isth_major():
    g = ISTHTestGenerator()
    g.run_tests()


if __name__ == "__main__":
    test_isth_major()
