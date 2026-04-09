import datetime
import pandas as pd

from phenex.phenotypes import CodelistPhenotype
from phenex.phenotypes.factory import TreatmentPatternAnalysis

from phenex.codelists import Codelist
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_nvariables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class TreatmentPatternAnalysisTestGenerator_Basic(PhenotypeTestGenerator):
    """Basic test with 3 phenotypes, 2 periods, all events at day 0.
    Since all events are at day 0 (same as INDEX_DATE), all events appear
    in all periods. Results per period are identical to StackableRegimen.
    """

    name_space = "treatment_pattern_basic"

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

        tpa = TreatmentPatternAnalysis(
            phenotypes=pts,
            regimen_keys=["one", "two", "three"],
            name="TP",
            days_between_periods=90,
            n_periods=2,
        )

        d = tpa.output_phenotypes_dict
        test_infos = []

        # Period 1: D0_to_D90
        # All events at day 0 are included (0 >= 0 and 0 < 90)
        # Results identical to StackableRegimen with 3 phenotypes
        p1 = d["treatment_patterns_D0_to_D90"]

        # stack1: single regimen
        test_infos.append({"name": "p1_s1", "persons": ["P4"], "phenotype": p1[0]})
        test_infos.append({"name": "p1_s2", "persons": ["P6"], "phenotype": p1[1]})
        test_infos.append({"name": "p1_s3", "persons": ["P7"], "phenotype": p1[2]})

        # stack2: dual regimen
        test_infos.append({"name": "p1_s12", "persons": ["P2"], "phenotype": p1[3]})
        test_infos.append({"name": "p1_s13", "persons": ["P3"], "phenotype": p1[4]})
        test_infos.append({"name": "p1_s23", "persons": ["P5"], "phenotype": p1[5]})

        # stack3: triple regimen
        test_infos.append({"name": "p1_s123", "persons": ["P1"], "phenotype": p1[6]})

        # Period 2: D90_to_D180 (key name suggests 90-180, but filter is cumulative [0, 180))
        # Same results since all events are at day 0 and fall within [0, 180)
        p2 = d["treatment_patterns_D90_to_D180"]

        test_infos.append({"name": "p2_s1", "persons": ["P4"], "phenotype": p2[0]})
        test_infos.append({"name": "p2_s2", "persons": ["P6"], "phenotype": p2[1]})
        test_infos.append({"name": "p2_s3", "persons": ["P7"], "phenotype": p2[2]})
        test_infos.append({"name": "p2_s12", "persons": ["P2"], "phenotype": p2[3]})
        test_infos.append({"name": "p2_s13", "persons": ["P3"], "phenotype": p2[4]})
        test_infos.append({"name": "p2_s23", "persons": ["P5"], "phenotype": p2[5]})
        test_infos.append({"name": "p2_s123", "persons": ["P1"], "phenotype": p2[6]})

        return test_infos


class TreatmentPatternAnalysisTestGenerator_TimePeriods(PhenotypeTestGenerator):
    """Test with 2 phenotypes, 2 periods, events at different time points.
    Verifies that time filtering correctly separates events into periods.

    Patient data (days relative to INDEX_DATE 2022-01-01):
        P1: c1 at day 5,  c2 at day 5
        P2: c1 at day 5
        P3: c2 at day 5
        P4: c1 at day 100, c2 at day 100
        P5: c1 at day 5,   c2 at day 100

    Period 1 (D0_to_D90):
        stack1[0] (c1 only):  P2, P5
        stack1[1] (c2 only):  P3
        stack2[0] (c1 & c2):  P1

    Period 2 (D90_to_D180, cumulative filter [0, 180)):
        stack1[0] (c1 only):  P2
        stack1[1] (c2 only):  P3
        stack2[0] (c1 & c2):  P1, P4, P5
    """

    name_space = "treatment_pattern_timeperiods"

    def define_input_tables(self):
        records = [
            {
                "PERSON_ID": "P1",
                "CODE": "c1",
                "CODE_TYPE": "ICD10CM",
                "EVENT_DATE": datetime.date(2022, 1, 6),
            },
            {
                "PERSON_ID": "P1",
                "CODE": "c2",
                "CODE_TYPE": "ICD10CM",
                "EVENT_DATE": datetime.date(2022, 1, 6),
            },
            {
                "PERSON_ID": "P2",
                "CODE": "c1",
                "CODE_TYPE": "ICD10CM",
                "EVENT_DATE": datetime.date(2022, 1, 6),
            },
            {
                "PERSON_ID": "P3",
                "CODE": "c2",
                "CODE_TYPE": "ICD10CM",
                "EVENT_DATE": datetime.date(2022, 1, 6),
            },
            {
                "PERSON_ID": "P4",
                "CODE": "c1",
                "CODE_TYPE": "ICD10CM",
                "EVENT_DATE": datetime.date(2022, 4, 11),
            },
            {
                "PERSON_ID": "P4",
                "CODE": "c2",
                "CODE_TYPE": "ICD10CM",
                "EVENT_DATE": datetime.date(2022, 4, 11),
            },
            {
                "PERSON_ID": "P5",
                "CODE": "c1",
                "CODE_TYPE": "ICD10CM",
                "EVENT_DATE": datetime.date(2022, 1, 6),
            },
            {
                "PERSON_ID": "P5",
                "CODE": "c2",
                "CODE_TYPE": "ICD10CM",
                "EVENT_DATE": datetime.date(2022, 4, 11),
            },
        ]
        df_condition_occurrence = pd.DataFrame(records)
        df_condition_occurrence["INDEX_DATE"] = datetime.date(2022, 1, 1)

        input_info_co = {
            "name": "CONDITION_OCCURRENCE",
            "df": df_condition_occurrence,
        }

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = ["P1", "P2", "P3", "P4", "P5"]
        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }
        return [input_info_co, input_info_person]

    def define_phenotype_tests(self):
        cls = ["c1", "c2"]

        pts = []
        for cl in cls:
            pt = CodelistPhenotype(
                name=cl, domain="CONDITION_OCCURRENCE", codelist=Codelist([cl])
            )
            pts.append(pt)

        tpa = TreatmentPatternAnalysis(
            phenotypes=pts,
            regimen_keys=["one", "two"],
            name="TP",
            days_between_periods=90,
            n_periods=2,
        )

        d = tpa.output_phenotypes_dict
        test_infos = []

        # Period 1: D0_to_D90 (events within [0, 90) days after INDEX_DATE)
        p1 = d["treatment_patterns_D0_to_D90"]

        test_infos.append(
            {"name": "p1_c1_only", "persons": ["P2", "P5"], "phenotype": p1[0]}
        )
        test_infos.append({"name": "p1_c2_only", "persons": ["P3"], "phenotype": p1[1]})
        test_infos.append({"name": "p1_both", "persons": ["P1"], "phenotype": p1[2]})

        # Period 2: D90_to_D180 (cumulative filter [0, 180) days after INDEX_DATE)
        # P4: c1 at day 100 AND c2 at day 100 -> both (now within window)
        # P5: c1 at day 5, c2 at day 100 -> both (now within window)
        p2 = d["treatment_patterns_D90_to_D180"]

        test_infos.append({"name": "p2_c1_only", "persons": ["P2"], "phenotype": p2[0]})
        test_infos.append({"name": "p2_c2_only", "persons": ["P3"], "phenotype": p2[1]})
        test_infos.append(
            {"name": "p2_both", "persons": ["P1", "P4", "P5"], "phenotype": p2[2]}
        )

        return test_infos


def test_treatment_pattern_basic():
    g = TreatmentPatternAnalysisTestGenerator_Basic()
    g.run_tests()


def test_treatment_pattern_time_periods():
    g = TreatmentPatternAnalysisTestGenerator_TimePeriods()
    g.run_tests()


if __name__ == "__main__":
    test_treatment_pattern_basic()
    test_treatment_pattern_time_periods()
