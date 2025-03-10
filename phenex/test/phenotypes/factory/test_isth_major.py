import datetime, os
import pandas as pd
import ibis
from phenex.test.cohort_test_generator import CohortTestGenerator
from phenex.codelists import Codelist
from phenex.phenotypes import Cohort, CodelistPhenotype
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

from phenex.mappers import OMOPPersonTableSource, OMOPProcedureOccurrenceSourceTable, OMOPConditionOccurrenceSourceTable, OMOPDeathTable

from phenex.test.util.dummy.generate_dummy_cohort_data import generate_dummy_cohort_data


class ISTHTestGenerator(CohortTestGenerator):
    def define_cohort(self):
        entry = CodelistPhenotype(
            name='entry',
            codelist = Codelist(["d0"]),
            domain = 'CONDITION_OCCURRENCE',
            return_date="first",
        )

        c = ISTHBleedComponents(
            critical_organ_bleed_codelist=Codelist(["d1"]),
            overt_bleed_codelist=Codelist(["d2"]),
            possible_bleed_codelist=Codelist(["d3"]),
            transfusion_codelist = Codelist(['t1']),
            
            inpatient = CategoricalFilter(column_name="ENCOUNTER_TYPE", allowed_values=['inpatient'], domain="VISIT_OCCURRENCE"),
            outpatient = CategoricalFilter(column_name="ENCOUNTER_TYPE", allowed_values=['outpatient'], domain="VISIT_OCCURRENCE"),
            primary_diagnosis = CategoricalFilter(column_name="DIAGNOSIS_POSITION", allowed_values=[1], domain="CONDITION_OCCURRENCE"),
            secondary_diagnosis = ~CategoricalFilter(column_name="DIAGNOSIS_POSITION", allowed_values=[1], domain="CONDITION_OCCURRENCE"),
            diagnosis_of = CategoricalFilter(column_name="STATUS", allowed_values=['DIAGNOSIS_OF'], domain="CONDITION_OCCURRENCE"),
            
            diagnosis_code_domain = 'CONDITION_OCCURRENCE_SOURCE',
            procedure_code_domain = 'PROCEDURE_OCCURRENCE_SOURCE',
            death_domain = 'DEATH',
        )

        isth_bleeding = ISTHMajorBleedingPhenotype(
            return_date="first",
            relative_time_range = RelativeTimeRangeFilter(when='after', anchor_phenotype=entry),
            components=c,
        )

        return Cohort(
            name="isth_major_bleed",
            entry_criterion=entry,
            inclusion=[isth_bleeding]
        )

    def generate_dummy_input_data(self):

        values = [
            {
                "name": "entry",
                "values": ["d0"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1)],
            },
            {
                "name": "d1",
                "values": ["d1"],
            },
            {
                "name": "d1date",
                "values": [datetime.date(2020, 2, 1), datetime.date(2019, 12, 1)],
            },
            {
                "name": "d2",
                "values": ["d2"],
            },
            {
                "name": "d2date",
                "values": [datetime.date(2020, 3, 1), datetime.date(2019, 11, 1)],
            },
            {
                "name": "d3",
                "values": ["d3"],
            },
            {
                "name": "d3date",
                "values": [datetime.date(2020, 4, 1), datetime.date(2019, 10, 1)],
            },
            {
                "name": "death",
                "values": [datetime.date(2020, 1, 15), datetime.date(2020, 2, 15), None],
            },
            {
                "name": "transfusion",
                "values": ["t1", "nt1"],
            },
            {
                "name": "transfusion_date",
                "values": [datetime.date(2020, 4, 2), None, datetime.date(2020, 4, 5)],
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
                "values": ['diagnosis_of', 'history_of'],
            },


        ]

        return generate_dummy_cohort_data(values)

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PERSON_ID", 'death']])
        schema_person = {"PERSON_ID": str, "death": datetime.date}
        person_table = OMOPPersonTableSource(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )

        # create condition occurrence df
        constant_columns = ['encounter_type', 'diagnosis_position', 'diagnosis_status']
        code_sets = ['d1', 'd2', 'd3']
        date_sets = ['d1date', 'd2date', 'd3date']
        dfs = []
        for code, date in zip(code_sets, date_sets):
            _df = df_allvalues[['PERSON_ID', code, date]+constant_columns]
            _df.columns = ["PERSON_ID", "CONDITION_SOURCE_VALUE", "CONDITION_START_DATE", "ENCOUNTER_TYPE", "DIAGNOSIS_POSITION", "STATUS"]
            dfs.append(_df)
        df_condition_occurrence = pd.concat(dfs)

        # create condition occurrence table
        schema_condition_occurrence = {
            "PERSON_ID": str,
            "CONDITION_SOURCE_VALUE": str,
            "CONDITION_START_DATE": datetime.date,
        }
        condition_occurrence_table = OMOPConditionOccurrenceSourceTable(
            self.con.create_table(
                "CONDITION_OCCURRENCE_SOURCE", df_condition_occurrence, schema=schema_condition_occurrence
            )
        )

        df_procedure_occurrence = pd.DataFrame(df_allvalues[["PERSON_ID", 'transfusion', 'transfusion_date']])
        df_procedure_occurrence.columns = ["PERSON_ID", "PROCEDURE_SOURCE_VALUE", "PROCEDURE_DATE"]

        # create procedure occurrence table
        schema_procedure_occurrence = {
            "PERSON_ID": str,
            "PROCEDURE_SOURCE_VALUE": str,
            "PROCEDURE_DATE": datetime.date,
        }
        procedure_occurrence_table = OMOPProcedureOccurrenceSourceTable(
            self.con.create_table(
                "CONDITION_OCCURRENCE_SOURCE", df_procedure_occurrence, schema=schema_procedure_occurrence
            )
        )
        return {
            "PERSON": person_table,
            "DEATH": person_table,
            "CONDITION_OCCURRENCE_SOURCE": condition_occurrence_table,
            "PROCEDURE_OCCURRENCE_SOURCE": procedure_occurrence_table,
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
