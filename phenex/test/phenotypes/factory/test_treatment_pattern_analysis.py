import datetime
import os
import pandas as pd
import ibis

from phenex.phenotypes import CodelistPhenotype
from phenex.phenotypes.factory import TreatmentPatternAnalysis

from phenex.codelists import Codelist
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_nvariables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.tables import CodeTable, PhenexPersonTable
from phenex.reporting import TreatmentPatternAnalysisSankeyReporter


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
        p1 = d["distribution_of_patients_per_stacked_regimen_from_day_0_to_90"]

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
        p2 = d["distribution_of_patients_per_stacked_regimen_from_day_90_to_180"]

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
        p1 = d["distribution_of_patients_per_stacked_regimen_from_day_0_to_90"]

        test_infos.append(
            {"name": "p1_c1_only", "persons": ["P2", "P5"], "phenotype": p1[0]}
        )
        test_infos.append({"name": "p1_c2_only", "persons": ["P3"], "phenotype": p1[1]})
        test_infos.append({"name": "p1_both", "persons": ["P1"], "phenotype": p1[2]})

        # Period 2: D90_to_D180 (cumulative filter [0, 180) days after INDEX_DATE)
        # P4: c1 at day 100 AND c2 at day 100 -> both (now within window)
        # P5: c1 at day 5, c2 at day 100 -> both (now within window)
        p2 = d["distribution_of_patients_per_stacked_regimen_from_day_90_to_180"]

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


def test_sankey_generation():
    """
    Integration test for TreatmentPatternAnalysisSankeyReporter.

    3 regimens (HT, EZT, FZT), 3 cumulative periods (0-90, 0-180, 0-270 days).
    Patients change regimen between periods, producing real cross-period flows.

    Patient  | day-0 drugs     | day-100 drugs | day-200 drugs
    ---------|-----------------|---------------|---------------
    P1       | HT              |               |
    P2       | EZT             |               |
    P3       | FZT             |               |
    P4       | HT + EZT        |               |
    P5       | HT              | + EZT         |              → switches from "HT only" to "HT + EZT"
    P6       | EZT             | + FZT         |              → switches from "EZT only" to "EZT + FZT"
    P7       |                 | HT            |              → enters period 2 as "HT only"
    P8       |                 | FZT           | + HT         → enters period 2 as "FZT only", switches to "HT + FZT"
    P9       | HT + EZT + FZT  |               |

    Expected flows P1→P2 (period 1 regimen → period 2 regimen):
      HT only   → HT only   : P1        (n=1)
      HT only   → HT + EZT  : P5        (n=1)
      EZT only  → EZT only  : P2        (n=1)
      EZT only  → EZT + FZT : P6        (n=1)
      FZT only  → FZT only  : P3        (n=1)
      HT + EZT  → HT + EZT  : P4        (n=1)
      ALL       → ALL        : P9        (n=1)

    Expected flows P2→P3 (period 2 regimen → period 3 regimen):
      HT only   → HT only   : P1, P7    (n=2)
      EZT only  → EZT only  : P2        (n=1)
      FZT only  → FZT only  : P3        (n=1)
      FZT only  → HT + FZT  : P8        (n=1)
      HT + EZT  → HT + EZT  : P4, P5   (n=2)
      EZT + FZT → EZT + FZT : P6        (n=1)
      ALL       → ALL        : P9        (n=1)
    """
    INDEX_DATE = datetime.date(2022, 1, 1)
    DAY_100 = datetime.date(2022, 4, 11)   # 100 days after index
    DAY_200 = datetime.date(2022, 7, 20)   # 200 days after index

    records = [
        # P1: HT at day 0
        {"PERSON_ID": "P1", "CODE": "ht",  "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        # P2: EZT at day 0
        {"PERSON_ID": "P2", "CODE": "ezt", "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        # P3: FZT at day 0
        {"PERSON_ID": "P3", "CODE": "fzt", "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        # P4: HT + EZT at day 0
        {"PERSON_ID": "P4", "CODE": "ht",  "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        {"PERSON_ID": "P4", "CODE": "ezt", "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        # P5: HT at day 0, EZT at day 100  →  HT only → HT+EZT → HT+EZT
        {"PERSON_ID": "P5", "CODE": "ht",  "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        {"PERSON_ID": "P5", "CODE": "ezt", "CODE_TYPE": "ICD10", "EVENT_DATE": DAY_100,    "INDEX_DATE": INDEX_DATE},
        # P6: EZT at day 0, FZT at day 100  →  EZT only → EZT+FZT → EZT+FZT
        {"PERSON_ID": "P6", "CODE": "ezt", "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        {"PERSON_ID": "P6", "CODE": "fzt", "CODE_TYPE": "ICD10", "EVENT_DATE": DAY_100,    "INDEX_DATE": INDEX_DATE},
        # P7: HT at day 100  →  (none) → HT only → HT only
        {"PERSON_ID": "P7", "CODE": "ht",  "CODE_TYPE": "ICD10", "EVENT_DATE": DAY_100,    "INDEX_DATE": INDEX_DATE},
        # P8: FZT at day 100, HT at day 200  →  (none) → FZT only → HT+FZT
        {"PERSON_ID": "P8", "CODE": "fzt", "CODE_TYPE": "ICD10", "EVENT_DATE": DAY_100,    "INDEX_DATE": INDEX_DATE},
        {"PERSON_ID": "P8", "CODE": "ht",  "CODE_TYPE": "ICD10", "EVENT_DATE": DAY_200,    "INDEX_DATE": INDEX_DATE},
        # P9: HT + EZT + FZT at day 0  →  ALL → ALL → ALL
        {"PERSON_ID": "P9", "CODE": "ht",  "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        {"PERSON_ID": "P9", "CODE": "ezt", "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
        {"PERSON_ID": "P9", "CODE": "fzt", "CODE_TYPE": "ICD10", "EVENT_DATE": INDEX_DATE, "INDEX_DATE": INDEX_DATE},
    ]

    df_co = pd.DataFrame(records)
    df_person = pd.DataFrame({"PERSON_ID": [f"P{i}" for i in range(1, 10)]})

    # Build DuckDB tables
    con = ibis.duckdb.connect()
    schema_co = {
        "PERSON_ID": str, "CODE": str, "CODE_TYPE": str,
        "EVENT_DATE": datetime.date, "INDEX_DATE": datetime.date,
    }
    co_table = con.create_table("CONDITION_OCCURRENCE", df_co, schema=schema_co)
    person_table = con.create_table("PERSON", df_person, schema={"PERSON_ID": str})

    domains = {
        "CONDITION_OCCURRENCE": CodeTable(co_table),
        "PERSON": PhenexPersonTable(person_table),
    }

    # Build TPA: 3 regimens, 3 periods of 90 days each (cumulative)
    cls = ["ht", "ezt", "fzt"]
    pts = [
        CodelistPhenotype(name=cl, domain="CONDITION_OCCURRENCE", codelist=Codelist([cl]))
        for cl in cls
    ]
    tpa = TreatmentPatternAnalysis(
        phenotypes=pts,
        regimen_keys=["HT", "EZT", "FZT"],
        name="TP",
        days_between_periods=90,
        n_periods=3,
    )

    # Execute every TPA output phenotype (resolves child CodelistPhenotypes automatically)
    for pt in tpa.output_phenotypes:
        pt.execute(domains)

    # Mock cohort — only needs .characteristics and .outcomes
    class _MockCohort:
        characteristics = tpa.output_phenotypes
        outcomes = []

    reporter = TreatmentPatternAnalysisSankeyReporter()
    df = reporter.execute(_MockCohort())

    # ------------------------------------------------------------------
    # Verify flows DataFrame structure
    # ------------------------------------------------------------------
    assert set(df.columns) >= {
        "tpa_name", "from_period", "to_period", "from_regimen", "to_regimen", "n_patients"
    }
    assert not df.empty, "Expected patient flows between periods"
    assert df["n_patients"].sum() > 0

    def flow(from_p, from_r, to_p, to_r):
        row = df[
            (df["from_period"] == from_p) & (df["from_regimen"] == from_r) &
            (df["to_period"]   == to_p)   & (df["to_regimen"]   == to_r)
        ]
        return int(row["n_patients"].iloc[0]) if not row.empty else 0

    # Period 1 → Period 2
    assert flow(1, "HT only",   2, "HT only")  == 1   # P1
    assert flow(1, "HT only",   2, "HT + EZT") == 1   # P5 added EZT
    assert flow(1, "EZT only",  2, "EZT only") == 1   # P2
    assert flow(1, "EZT only",  2, "EZT + FZT") == 1  # P6 added FZT
    assert flow(1, "FZT only",  2, "FZT only") == 1   # P3
    assert flow(1, "HT + EZT",  2, "HT + EZT") == 1   # P4 stays
    assert flow(1, "HT + EZT + FZT", 2, "HT + EZT + FZT") == 1  # P9

    # Period 2 → Period 3
    assert flow(2, "HT only",   3, "HT only")  == 2   # P1 + P7
    assert flow(2, "EZT only",  3, "EZT only") == 1   # P2
    assert flow(2, "FZT only",  3, "FZT only") == 1   # P3
    assert flow(2, "FZT only",  3, "HT + FZT") == 1   # P8 added HT
    assert flow(2, "HT + EZT",  3, "HT + EZT") == 2   # P4 + P5
    assert flow(2, "EZT + FZT", 3, "EZT + FZT") == 1  # P6
    assert flow(2, "HT + EZT + FZT", 3, "HT + EZT + FZT") == 1  # P9

    # ------------------------------------------------------------------
    # Write HTML to artifacts directory (like other tests) for inspection
    # ------------------------------------------------------------------
    artifacts_dir = os.path.join(
        os.path.dirname(__file__), "..", "artifacts", "treatment_pattern_sankey"
    )
    os.makedirs(artifacts_dir, exist_ok=True)
    html_path = os.path.join(artifacts_dir, "sankey.html")
    reporter.to_html(html_path)

    assert os.path.exists(html_path)
    html = open(html_path, encoding="utf-8").read()

    assert "d3-sankey" in html
    assert "HT only" in html
    assert "EZT only" in html
    assert "FZT only" in html
    assert "HT + EZT" in html
    assert "EZT + FZT" in html
    assert "HT + EZT + FZT" in html


if __name__ == "__main__":
    test_treatment_pattern_basic()
    test_treatment_pattern_time_periods()
    test_sankey_generation()
