import datetime, os
import pandas as pd
import ibis
from phenex.test.cohort_test_generator import CohortTestGenerator
from phenex.codelists import Codelist
from phenex.phenotypes import Cohort, CodelistPhenotype
from phenex.phenotypes.factory.isth_major_bleed import (
    ISTHMajorBleedPhenotype,
    ISTHBleedComponents,
    FatalBleedPhenotype,
    SymptomaticBleedPhenotype,
    CriticalOrganBleedPhenotype,
)

from phenex.filters import (
    DateFilter,
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    GreaterThan,
    CategoricalFilter,
)
from phenex.test.cohort.test_mappings import (
    PersonTableForTests,
    DrugExposureTableForTests,
    ObservationPeriodTableForTests,
    ConditionOccurenceTableForTests,
)

from phenex.mappers import (
    OMOPPersonTable,
    OMOPProcedureOccurrenceSourceTable,
    OMOPConditionOccurrenceSourceTable,
    OMOPDeathTable,
    OMOPMeasurementTable,
)

from phenex.test.util.dummy.generate_dummy_cohort_data import generate_dummy_cohort_data
from phenex.test.phenotypes.factory.test_isth_major import ISTHTestGenerator


def get_ISTH_components():
    return ISTHBleedComponents(
        critical_organ_bleed_codelist=Codelist(["critical_organ_bleed"]),
        overt_bleed_codelist=Codelist(["overt_bleed"]),
        possible_bleed_codelist=Codelist(["possible_bleed"]),
        transfusion_codelist=Codelist(["t1"]),
        inpatient=CategoricalFilter(
            column_name="ENCOUNTER_TYPE",
            allowed_values=["inpatient"],
            domain="CONDITION_OCCURRENCE_SOURCE",
        ),
        outpatient=CategoricalFilter(
            column_name="ENCOUNTER_TYPE",
            allowed_values=["outpatient"],
            domain="CONDITION_OCCURRENCE_SOURCE",
        ),
        primary_diagnosis=CategoricalFilter(
            column_name="DIAGNOSIS_POSITION",
            allowed_values=[1],
            domain="CONDITION_OCCURRENCE_SOURCE",
        ),
        secondary_diagnosis=~CategoricalFilter(
            column_name="DIAGNOSIS_POSITION",
            allowed_values=[1],
            domain="CONDITION_OCCURRENCE_SOURCE",
        ),
        diagnosis_of=CategoricalFilter(
            column_name="STATUS",
            allowed_values=["DIAGNOSIS_OF"],
            domain="CONDITION_OCCURRENCE_SOURCE",
        ),
        diagnosis_code_domain="CONDITION_OCCURRENCE_SOURCE",
        procedure_code_domain="PROCEDURE_OCCURRENCE_SOURCE",
        death_domain="DEATH",
        measurement_code_domain="MEASUREMENT",
        hemoglobin_codelist=Codelist(["hb"], use_code_type=False),
    )


class ISTHTestGeneratorWithHb(ISTHTestGenerator):

    def define_isth_phenotype(self, entry):
        return ISTHMajorBleedPhenotype(
            name="isth_with_hb",
            return_date="first",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", anchor_phenotype=entry
            ),
            components=get_ISTH_components(),
        )

    def generate_dummy_input_values_dict(self):
        one_day = datetime.timedelta(days=1)
        values_standard = super().generate_dummy_input_values_dict()

        values_new = [
            {"name": "hb", "values": ["hb"]},
            {"name": "hb1", "values": [12]},
            {"name": "hb2", "values": [8, 12]},
            {
                "name": "hb1_date",
                "values": [
                    datetime.date(2020, 3, 1) - one_day
                ],  # all hb1 events occur on postindex overt_bleeddate
            },
            {
                "name": "hb2_date",
                "values": [
                    datetime.date(2020, 3, 1),
                    datetime.date(2020, 3, 1) + 3 * one_day,
                ],
            },
        ]

        return values_standard + values_new

    def define_mapped_tables(self):
        df_allvalues = self.generate_dummy_input_data()

        mapped_tables = super().define_mapped_tables()

        df_hb1 = pd.DataFrame(df_allvalues[["PATID", "hb1_date", "hb", "hb1"]])
        df_hb1.columns = [
            "PERSON_ID",
            "MEASUREMENT_DATE",
            "MEASUREMENT_TYPE_CONCEPT_ID",
            "VALUE_AS_NUMBER",
        ]
        df_hb2 = pd.DataFrame(df_allvalues[["PATID", "hb2_date", "hb", "hb2"]])
        df_hb2.columns = [
            "PERSON_ID",
            "MEASUREMENT_DATE",
            "MEASUREMENT_TYPE_CONCEPT_ID",
            "VALUE_AS_NUMBER",
        ]
        df_measurement = pd.concat([df_hb1, df_hb2], axis=0)
        # create measurement table
        schema_measurement = {
            "PERSON_ID": str,
            "MEASUREMENT_DATE": datetime.date,
            "MEASUREMENT_TYPE_CONCEPT_ID": str,
            "VALUE_AS_NUMBER": int,
        }
        measurement_table = OMOPMeasurementTable(
            self.con.create_table(
                "MEASUREMENT",
                df_measurement,
                schema=schema_measurement,
            )
        )
        mapped_tables["MEASUREMENT"] = measurement_table
        return mapped_tables

    def get_correct_symptommatic_bleed_patients(self):
        df = self.generate_dummy_input_data()
        _df = df[df["overt_bleeddate"] == datetime.date(2020, 3, 1)]
        _df = _df[_df["encounter_type"] == "inpatient"]
        _df = _df[_df["diagnosis_status"] == "DIAGNOSIS_OF"]
        _df = _df[_df["diagnosis_position"] == 1]
        _df = _df[
            (
                (_df["transfusion"] == "t1")
                & (_df["transfusion_date"] == datetime.date(2020, 3, 2))
            )
            | ((_df["hb2_date"] == datetime.date(2020, 3, 1)) & (_df["hb2"] == 8))
        ]
        patids_overt = list(_df["PATID"].values)
        return patids_overt


class ISTHCriticalOrganBleedTestGenerator(ISTHTestGeneratorWithHb):
    def define_isth_phenotype(self, entry):
        return CriticalOrganBleedPhenotype(
            name="isth_with_hb_critical_organ_bleed",
            return_date="first",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", anchor_phenotype=entry
            ),
            components=get_ISTH_components(),
        )

    def get_correct_patients(self):
        patids_critical_organs = self.get_correct_critical_organ_bleed_patients()
        return patids_critical_organs


class ISTHSymptommaticBleedTestGenerator(ISTHTestGeneratorWithHb):
    def define_isth_phenotype(self, entry):
        return SymptomaticBleedPhenotype(
            name="isth_with_hb_symptommatic_bleed",
            return_date="first",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", anchor_phenotype=entry
            ),
            components=get_ISTH_components(),
        )

    def get_correct_patients(self):
        patids_overt = self.get_correct_symptommatic_bleed_patients()
        return patids_overt


class ISTHFatalBleedTestGenerator(ISTHTestGeneratorWithHb):
    def define_isth_phenotype(self, entry):
        return FatalBleedPhenotype(
            name="isth_with_hb_fatal_bleed",
            return_date="first",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", anchor_phenotype=entry
            ),
            components=get_ISTH_components(),
        )

    def get_correct_patients(self):
        patids_death = self.get_correct_fatal_bleed_patients()
        return patids_death


def test_critical_organ_with_hb():
    g = ISTHCriticalOrganBleedTestGenerator()
    g.run_tests()


def test_symptomatic_with_hb():
    g = ISTHSymptommaticBleedTestGenerator()
    g.run_tests()


def test_fatal_with_hb():
    g = ISTHFatalBleedTestGenerator()
    g.run_tests()


def test_isth_major_with_hb():
    g = ISTHTestGenerator()
    g.run_tests()


if __name__ == "__main__":
    # test_critical_organ_with_hb()
    test_symptomatic_with_hb()
    # test_fatal_with_hb()
    # test_isth_major_with_hb()
