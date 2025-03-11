import datetime, os
import pandas as pd
import ibis
from phenex.test.cohort_test_generator import CohortTestGenerator
from phenex.codelists import Codelist
from phenex.phenotypes import Cohort, CodelistPhenotype
from phenex.phenotypes.factory.isth_major_bleeding import (
    ISTHMajorBleedingPhenotype,
    ISTHBleedComponents,
    FatalBleedPhenotype,
    SymptomaticBleedPhenotype,
    CriticalOrganBleedPhenotype,
)

from phenex.filters import (
    DateRangeFilter,
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
)

from phenex.test.util.dummy.generate_dummy_cohort_data import generate_dummy_cohort_data


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
    )


class ISTHTestGenerator(CohortTestGenerator):
    def define_isth_phenotype(self, entry):
        return ISTHMajorBleedingPhenotype(
            return_date="first",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", anchor_phenotype=entry
            ),
            components=get_ISTH_components(),
        )

    def define_cohort(self):
        entry = CodelistPhenotype(
            name="entry",
            codelist=Codelist(["d0"]),
            domain="CONDITION_OCCURRENCE_SOURCE",
            return_date="first",
        )

        isth_phenotype = self.define_isth_phenotype(entry)
        return Cohort(
            name=isth_phenotype.name, entry_criterion=entry, inclusions=[isth_phenotype]
        )

    def generate_dummy_input_data(self):
        values = [
            {
                "name": "entry",
                "values": ["d0"],  # all patients have an entry criteium
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1)],  # all index days jan 1 2020
            },
            {
                "name": "critical_organ_bleed",
                "values": ["critical_organ_bleed"],
            },
            {
                "name": "critical_organ_bleeddate",
                "values": [datetime.date(2020, 2, 1), datetime.date(2019, 12, 1)],
                # have of patients have a critical organ bleed bleed on frebruary 1 2020, so should fulfill critical organ bleed criteria!
            },
            {
                "name": "overt_bleed",
                "values": ["overt_bleed"],
            },
            {
                "name": "overt_bleeddate",
                "values": [datetime.date(2020, 3, 1), datetime.date(2019, 11, 1)],
            },
            {
                "name": "possible_bleed",
                "values": ["possible_bleed"],
            },
            {
                "name": "possible_bleeddate",
                "values": [datetime.date(2020, 4, 1), datetime.date(2019, 10, 1)],
            },
            {
                "name": "death",
                "values": [
                    datetime.date(2020, 2, 15),
                    datetime.date(2020, 5, 15),
                    None,
                ],
            },
            {
                "name": "transfusion",
                "values": ["t1", "nt1"],
            },
            {
                "name": "transfusion_date",
                "values": [datetime.date(2020, 3, 2), None, datetime.date(2020, 4, 2)],
            },
            {
                "name": "encounter_type",
                "values": ["inpatient", "outpatient"],
            },
            {
                "name": "diagnosis_position",
                "values": [1, 2],
            },
            {
                "name": "diagnosis_status",
                "values": ["DIAGNOSIS_OF", "HISTORY_OF"],
            },
        ]

        return generate_dummy_cohort_data(values)

    def get_correct_critical_organ_bleed_patients(self):
        df = self.generate_dummy_input_data()

        _df = df[df["critical_organ_bleeddate"] == datetime.date(2020, 2, 1)]
        _df = _df[_df["encounter_type"] == "inpatient"]
        _df = _df[_df["diagnosis_status"] == "DIAGNOSIS_OF"]
        patids_critical_organs = list(_df["PATID"].values)
        return patids_critical_organs

    def get_correct_symptommatic_bleed_patients(self):
        df = self.generate_dummy_input_data()

        _df = df[df["overt_bleeddate"] == datetime.date(2020, 3, 1)]
        _df = _df[_df["encounter_type"] == "inpatient"]
        _df = _df[_df["diagnosis_status"] == "DIAGNOSIS_OF"]
        _df = _df[_df["transfusion"] == "t1"]
        _df = _df[_df["transfusion_date"] == datetime.date(2020, 3, 2)]
        patids_overt = list(_df["PATID"].values)
        return patids_overt

    def get_correct_fatal_bleed_patients(self):
        df = self.generate_dummy_input_data()

        _df = df[df["death"] == datetime.date(2020, 2, 15)]
        _df = _df[_df["critical_organ_bleeddate"] == datetime.date(2020, 2, 1)]
        _df = _df[_df["diagnosis_status"] == "DIAGNOSIS_OF"]
        _df = _df[_df["encounter_type"] == "outpatient"]
        _df = _df[_df["diagnosis_position"] == 1]
        patids_death = list(_df["PATID"].values)

        return patids_death

    def get_correct_patients(self):
        patids_death = self.get_correct_fatal_bleed_patients()
        patids_overt = self.get_correct_symptommatic_bleed_patients()
        patids_critical_organs = self.get_correct_critical_organ_bleed_patients()

        return list(set(patids_critical_organs + patids_overt + patids_death))

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        df_allvalues.to_csv(
            os.path.join(self.dirpaths["input"], "df_all_values.csv"), index=False
        )
        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID"]])
        df_person.columns = ["PERSON_ID"]
        df_person["BIRTH_DATETIME"] = datetime.date(1990, 1, 1)

        schema_person = {"PERSON_ID": str, "BIRTH_DATETIME": datetime.date}
        person_table = OMOPPersonTable(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )

        # create dummy death table
        df_death = pd.DataFrame(df_allvalues[["PATID", "death"]])
        df_death.columns = ["PERSON_ID", "DEATH_DATE"]

        schema_death = {"PERSON_ID": str, "DEATH_DATE": datetime.date}
        death_table = OMOPDeathTable(
            self.con.create_table("DEATH", df_death, schema=schema_death)
        )

        # create condition occurrence df
        constant_columns = ["encounter_type", "diagnosis_position", "diagnosis_status"]
        code_sets = ["entry", "critical_organ_bleed", "overt_bleed", "possible_bleed"]
        date_sets = [
            "entry_date",
            "critical_organ_bleeddate",
            "overt_bleeddate",
            "possible_bleeddate",
        ]
        dfs = []
        for code, date in zip(code_sets, date_sets):
            _df = df_allvalues[["PATID", code, date] + constant_columns]
            _df.columns = [
                "PERSON_ID",
                "CONDITION_SOURCE_VALUE",
                "CONDITION_START_DATE",
                "ENCOUNTER_TYPE",
                "DIAGNOSIS_POSITION",
                "STATUS",
            ]
            dfs.append(_df)
        df_condition_occurrence = pd.concat(dfs)

        # create condition occurrence table
        schema_condition_occurrence = {
            "PERSON_ID": str,
            "CONDITION_SOURCE_VALUE": str,
            "CONDITION_START_DATE": datetime.date,
            "ENCOUNTER_TYPE": str,
            "DIAGNOSIS_POSITION": int,
            "STATUS": str,
        }
        condition_occurrence_table = OMOPConditionOccurrenceSourceTable(
            self.con.create_table(
                "CONDITION_OCCURRENCE_SOURCE",
                df_condition_occurrence,
                schema=schema_condition_occurrence,
            )
        )

        df_procedure_occurrence = pd.DataFrame(
            df_allvalues[["PATID", "transfusion", "transfusion_date"]]
        )
        df_procedure_occurrence.columns = [
            "PERSON_ID",
            "PROCEDURE_SOURCE_VALUE",
            "PROCEDURE_DATE",
        ]

        # create procedure occurrence table
        schema_procedure_occurrence = {
            "PERSON_ID": str,
            "PROCEDURE_SOURCE_VALUE": str,
            "PROCEDURE_DATE": datetime.date,
        }
        procedure_occurrence_table = OMOPProcedureOccurrenceSourceTable(
            self.con.create_table(
                "PROCEDURE_OCCURRENCE_SOURCE",
                df_procedure_occurrence,
                schema=schema_procedure_occurrence,
            )
        )

        df_person.to_csv(
            os.path.join(self.dirpaths["input"], "df_person.csv"), index=False
        )
        df_death.to_csv(
            os.path.join(self.dirpaths["input"], "df_death.csv"), index=False
        )
        df_condition_occurrence.to_csv(
            os.path.join(self.dirpaths["input"], "df_condition_occurrence.csv"),
            index=False,
        )
        df_procedure_occurrence.to_csv(
            os.path.join(self.dirpaths["input"], "df_procedure_occurrence.csv"),
            index=False,
        )

        return {
            "PERSON": person_table,
            "DEATH": death_table,
            "CONDITION_OCCURRENCE_SOURCE": condition_occurrence_table,
            "PROCEDURE_OCCURRENCE_SOURCE": procedure_occurrence_table,
        }

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        patids = self.get_correct_patients()
        df_expected_index["PERSON_ID"] = patids
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


class ISTHCriticalOrganBleedTestGenerator(ISTHTestGenerator):
    def define_isth_phenotype(self, entry):
        return CriticalOrganBleedPhenotype(
            return_date="first",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", anchor_phenotype=entry
            ),
            components=get_ISTH_components(),
        )

    def get_correct_patients(self):
        patids_critical_organs = self.get_correct_critical_organ_bleed_patients()
        return patids_critical_organs


class ISTHSymptommaticBleedTestGenerator(ISTHTestGenerator):
    def define_isth_phenotype(self, entry):
        return SymptomaticBleedPhenotype(
            return_date="first",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", anchor_phenotype=entry
            ),
            components=get_ISTH_components(),
        )

    def get_correct_patients(self):
        patids_overt = self.get_correct_symptommatic_bleed_patients()
        return patids_overt


class ISTHFatalBleedTestGenerator(ISTHTestGenerator):
    def define_isth_phenotype(self, entry):
        return FatalBleedPhenotype(
            return_date="first",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", anchor_phenotype=entry
            ),
            components=get_ISTH_components(),
        )

    def get_correct_patients(self):
        patids_death = self.get_correct_fatal_bleed_patients()
        return patids_death


def test_critical_organ():
    g = ISTHCriticalOrganBleedTestGenerator()
    g.run_tests()


def test_symptomatic():
    g = ISTHSymptommaticBleedTestGenerator()
    g.run_tests()


def test_fatal():
    g = ISTHFatalBleedTestGenerator()
    g.run_tests()


def test_isth_major():
    g = ISTHTestGenerator()
    g.run_tests()


if __name__ == "__main__":
    test_critical_organ()
    test_symptomatic()
    test_fatal()
    test_isth_major()
