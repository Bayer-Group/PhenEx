import datetime, os
import pandas as pd

from phenex.phenotypes import CodelistPhenotype
from phenex.phenotypes.factory import StackableRegimen

from phenex.codelists import LocalCSVCodelistFactory, Codelist
from phenex.filters.date_filter import DateFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_nvariables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters import Value, ValueFilter

from phenex.mappers import *


class StackableRegimenTestGenerator_3(PhenotypeTestGenerator):
    name_space = "stackablereg_3"

    def define_input_tables(self):
        df_condition_occurrence = sdf_and_tt_dummycodes_nvariables(n=3)[0]
        df_condition_occurrence["INDEX_DATE"] = datetime.date(2022, 1, 1)
        df_condition_occurrence.columns = [
            x.upper() for x in df_condition_occurrence.columns
        ]
        input_info_co = {
            "name": "CONDITION_OCCURRENCE",
            "df": df_condition_occurrence,
        }

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = df_condition_occurrence["PERSON_ID"].unique()
        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }
        return [input_info_co, input_info_person]

    def define_phenotype_tests(self):
        cls = ["c1", "c2", "c3"]

        pts = []
        for cl in cls:
            pt = CodelistPhenotype(
                name=cl, domain="CONDITION_OCCURRENCE", codelist=Codelist([cl])
            )
            pts.append(pt)

        stackable_regimen = StackableRegimen(
            phenotypes=pts, regimen_keys=["one", "two", "three"]
        )
        test_infos = []

        sr_dict = stackable_regimen.output_phenotypes_dict

        # single regime
        test_infos.append(
            {"name": "s1", "persons": ["P4"], "phenotype": sr_dict["stack1"][0]}
        )

        test_infos.append(
            {"name": "s2", "persons": ["P6"], "phenotype": sr_dict["stack1"][1]}
        )

        test_infos.append(
            {"name": "s3", "persons": ["P7"], "phenotype": sr_dict["stack1"][2]}
        )

        # dual regime
        test_infos.append(
            {"name": "s12", "persons": ["P2"], "phenotype": sr_dict["stack2"][0]}
        )

        test_infos.append(
            {"name": "s13", "persons": ["P3"], "phenotype": sr_dict["stack2"][1]}
        )

        test_infos.append(
            {"name": "s23", "persons": ["P5"], "phenotype": sr_dict["stack2"][2]}
        )

        # triple regime
        test_infos.append(
            {"name": "s123", "persons": ["P1"], "phenotype": sr_dict["stack3"][0]}
        )
        return test_infos


class StackableRegimenTestGenerator_4(PhenotypeTestGenerator):
    name_space = "stackablereg_4"

    def define_input_tables(self):
        """
        c1  c2  c3  c4   patid
        1   1   1   1    P1
        1   1   1   0    P2
        1   1   0   1    P3
        1   1   0   0    P4
        1   0   1   1    P5
        1   0   1   0    P6
        1   0   0   1    P7
        1   0   0   0    P8
        0   1   1   1    P9
        0   1   1   0    P10
        0   1   0   1    P11
        0   1   0   0    P12
        0   0   1   1    P13
        0   0   1   0    P14
        0   0   0   1    P15
        """
        df_condition_occurrence, df_truth_table = sdf_and_tt_dummycodes_nvariables(n=4)
        df_condition_occurrence["INDEX_DATE"] = datetime.date(2022, 1, 1)
        df_condition_occurrence.columns = [
            x.upper() for x in df_condition_occurrence.columns
        ]
        input_info_co = {
            "name": "CONDITION_OCCURRENCE",
            "df": df_condition_occurrence,
        }
        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = df_condition_occurrence["PERSON_ID"].unique()
        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }
        return [input_info_co, input_info_person]

    def define_phenotype_tests(self):
        cls = ["c1", "c2", "c3", "c4"]

        pts = []
        for cl in cls:
            pt = CodelistPhenotype(
                name=cl, domain="CONDITION_OCCURRENCE", codelist=Codelist([cl])
            )
            pts.append(pt)

        stackable_regimen = StackableRegimen(
            phenotypes=pts, regimen_keys=["one", "two", "three", "four"]
        )  # ,'five'])
        test_infos = []

        sr_dict = stackable_regimen.output_phenotypes_dict

        # single regime
        test_infos.append(
            {"name": "s_4_1", "persons": ["P8"], "phenotype": sr_dict["stack1"][0]}
        )

        test_infos.append(
            {"name": "s_4_2", "persons": ["P12"], "phenotype": sr_dict["stack1"][1]}
        )

        test_infos.append(
            {"name": "s_4_3", "persons": ["P14"], "phenotype": sr_dict["stack1"][2]}
        )

        test_infos.append(
            {"name": "s_4_4", "persons": ["P15"], "phenotype": sr_dict["stack1"][3]}
        )

        # dual regime
        test_infos.append(
            {"name": "s_4_12", "persons": ["P4"], "phenotype": sr_dict["stack2"][0]}
        )

        test_infos.append(
            {"name": "s_4_13", "persons": ["P6"], "phenotype": sr_dict["stack2"][1]}
        )
        test_infos.append(
            {"name": "s_4_14", "persons": ["P7"], "phenotype": sr_dict["stack2"][2]}
        )

        test_infos.append(
            {"name": "s_4_23", "persons": ["P10"], "phenotype": sr_dict["stack2"][3]}
        )

        test_infos.append(
            {"name": "s_4_24", "persons": ["P11"], "phenotype": sr_dict["stack2"][4]}
        )

        test_infos.append(
            {"name": "s_4_34", "persons": ["P13"], "phenotype": sr_dict["stack2"][5]}
        )

        # triple regime
        test_infos.append(
            {"name": "s_4_123", "persons": ["P2"], "phenotype": sr_dict["stack3"][0]}
        )

        test_infos.append(
            {"name": "s_4_124", "persons": ["P3"], "phenotype": sr_dict["stack3"][1]}
        )

        test_infos.append(
            {"name": "s_4_134", "persons": ["P5"], "phenotype": sr_dict["stack3"][2]}
        )

        test_infos.append(
            {"name": "s_4_234", "persons": ["P9"], "phenotype": sr_dict["stack3"][3]}
        )

        # regime 4
        test_infos.append(
            {"name": "s_4_1234", "persons": ["P1"], "phenotype": sr_dict["stack4"][0]}
        )
        self.test_infos = test_infos

        return test_infos


def test_stack_3():
    g = StackableRegimenTestGenerator_3()
    g.run_tests()


def test_stack_4():
    g = StackableRegimenTestGenerator_4()
    g.run_tests()


if __name__ == "__main__":
    test_stack_3()
    test_stack_4()
