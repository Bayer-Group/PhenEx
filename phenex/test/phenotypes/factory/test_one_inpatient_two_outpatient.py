import datetime, os
import pandas as pd


from phenex.phenotypes import LogicPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.codelists.codelists import Codelist
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.phenotypes.factory.one_inpatient_two_outpatient import (
    OneInpatientTwoOutpatientPhenotype,
)

from phenex.filters import (
    CategoricalFilter,
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    LessThanOrEqualTo,
    LessThan,
    GreaterThan,
    ValueFilter,
)


def build_fake_condition_data():
    fake_data = [
        # p1:pass, one inpatiemt and two outpatient
        {
            "PERSON_ID": "P1",
            "EVENT_DATE": datetime.date(2021, 10, 10),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        {
            "PERSON_ID": "P1",
            "EVENT_DATE": datetime.date(2021, 10, 11),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        {
            "PERSON_ID": "P1",
            "EVENT_DATE": datetime.date(2021, 10, 12),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        # p2: pass, two outpatient
        {
            "PERSON_ID": "P2",
            "EVENT_DATE": datetime.date(2021, 9, 5),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        {
            "PERSON_ID": "P2",
            "EVENT_DATE": datetime.date(2021, 9, 20),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        # p3: pass, one inpatient, one outpatient
        {
            "PERSON_ID": "P3",
            "EVENT_DATE": datetime.date(2021, 8, 2),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        {
            "PERSON_ID": "P3",
            "EVENT_DATE": datetime.date(2021, 8, 15),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        # p4: pass, one inpatient
        {
            "PERSON_ID": "P4",
            "EVENT_DATE": datetime.date(2021, 7, 10),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        # p5, not pass, only one outpatient
        {
            "PERSON_ID": "P5",
            "EVENT_DATE": datetime.date(2021, 6, 10),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        # p6, not pass, inpatient after index
        {
            "PERSON_ID": "P6",
            "EVENT_DATE": datetime.date(2024, 6, 10),
            "CODE": "C1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
    ]

    df = pd.DataFrame(fake_data)
    df["INDEX_DATE"] = pd.Timestamp("2022-09-20")
    return df


class OneInpatientTwoOutpatientPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "oitp"

    def define_input_tables(self):
        df_conditions = build_fake_condition_data()
        df_persons = pd.DataFrame({"PERSON_ID": df_conditions["PERSON_ID"].unique()})
        return [
            {"name": "CONDITION_OCCURRENCE", "df": df_conditions},
            {"name": "PERSON", "df": df_persons},
        ]

    def define_phenotype_tests(self):

        f_relative_time_range = RelativeTimeRangeFilter(
            when="before",
        )
        f_categorical_filter_inpatient = CategoricalFilter(
            column_name="ENCOUNTER_TYPE",
            allowed_values=["inpatient"],
            domain="CONDITION_OCCURRENCE",
        )

        f_categorical_filter_outpatient = CategoricalFilter(
            column_name="ENCOUNTER_TYPE",
            allowed_values=["outpatient"],
            domain="CONDITION_OCCURRENCE",
        )

        c1 = {
            "name": "c1",
            "persons": [f"P{i}" for i in range(1, 5)],
            "phenotype": OneInpatientTwoOutpatientPhenotype(
                name="OneInpatientTwoOutpatient",
                domain="CONDITION_OCCURRENCE",
                codelist=Codelist({"ICD10": ["C1"]}),
                relative_time_range=f_relative_time_range,
                categorical_filter_inpatient=f_categorical_filter_inpatient,
                categorical_filter_outpatient=f_categorical_filter_outpatient,
                return_date="first",
            ),
        }

        test_infos = [c1]

        return test_infos


def test_one_inpatient_two_outpatient():
    tg = OneInpatientTwoOutpatientPhenotypeTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_one_inpatient_two_outpatient()
