"""
Integration tests for Table2 reporter using real Cohort objects with explicitly
generated outcome data so expected results can be calculated by hand.

Test scenario:
- 8 patients enter cohort (entry code "d1", index date 2020-01-01)
- All have >= 1 year continuous coverage
- Two outcomes tracked via CONDITION_OCCURRENCE codes:
    outcome_a ("oa"): patients P0 (day 100), P2 (day 200), P4 (day 300)
    outcome_b ("ob"): patients P0 (day 50)

Expected Table2 results at time_point=365:
  outcome_a:
    N_Events = 3
    person-time = (100 + 200 + 300 + 5*365) / 365.25 = 6.639 patient-years
    Incidence_Rate = 3 / 6.639 * 100 = 45.184 per 100 patient-years

  outcome_b:
    N_Events = 1
    person-time = (50 + 7*365) / 365.25 = 7.131 patient-years
    Incidence_Rate = 1 / 7.131 * 100 = 14.023 per 100 patient-years
"""

import datetime
import pandas as pd
import pytest

from phenex.ibis_connect import DuckDBConnector
from phenex.codelists import Codelist
from phenex.core import Cohort
from phenex.phenotypes import CodelistPhenotype, TimeRangePhenotype
from phenex.filters import RelativeTimeRangeFilter, GreaterThanOrEqualTo
from phenex.reporting.table2 import Table2

from phenex.test.cohort.test_mappings import (
    PersonTableForTests,
    DrugExposureTableForTests,
    ObservationPeriodTableForTests,
    ConditionOccurenceTableForTests,
)


def _build_cohort_and_tables():
    """Build a cohort with two outcomes and return (cohort, mapped_tables, con)."""
    # ── Entry criterion ──────────────────────────────────────────────────
    entry = CodelistPhenotype(
        name="entry",
        return_date="first",
        codelist=Codelist(["d1"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )

    # ── Inclusion: >= 365 days continuous coverage ───────────────────────
    cc = TimeRangePhenotype(
        name="continuous_coverage",
        relative_time_range=RelativeTimeRangeFilter(min_days=GreaterThanOrEqualTo(365)),
    )

    # ── Outcomes ─────────────────────────────────────────────────────────
    outcome_a = CodelistPhenotype(
        name="outcome_a",
        return_date="first",
        codelist=Codelist(["oa"]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
    )

    outcome_b = CodelistPhenotype(
        name="outcome_b",
        return_date="first",
        codelist=Codelist(["ob"]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
    )

    cohort = Cohort(
        name="test_table2_cohort",
        entry_criterion=entry,
        inclusions=[cc],
        outcomes=[outcome_a, outcome_b],
    )

    # ── Test data ────────────────────────────────────────────────────────
    # 8 patients, all with entry code d1 on 2020-01-01, all with valid coverage
    index_date = datetime.date(2020, 1, 1)
    patient_ids = [f"P{i}" for i in range(8)]

    con = DuckDBConnector()

    # Person table
    df_person = pd.DataFrame(
        {
            "PATID": patient_ids,
            "YOB": [1980] * 8,
            "GENDER": [1] * 8,
            "ACCEPTABLE": [1] * 8,
        }
    )
    person_table = PersonTableForTests(
        con.dest_connection.create_table(
            "PERSON",
            df_person,
            schema={
                "PATID": str,
                "YOB": int,
                "GENDER": int,
                "ACCEPTABLE": int,
            },
        )
    )

    # Drug exposure table (entry codes)
    df_drug = pd.DataFrame(
        {
            "PATID": patient_ids,
            "PRODCODEID": ["d1"] * 8,
            "ISSUEDATE": [index_date] * 8,
        }
    )
    drug_table = DrugExposureTableForTests(
        con.dest_connection.create_table(
            "DRUG_EXPOSURE",
            df_drug,
            schema={
                "PATID": str,
                "PRODCODEID": str,
                "ISSUEDATE": datetime.date,
            },
        )
    )

    # Observation period table (all have > 1 year prior coverage)
    df_obs = pd.DataFrame(
        {
            "PATID": patient_ids,
            "REGSTARTDATE": [datetime.date(2018, 1, 1)] * 8,
            "REGENDDATE": [datetime.date(2021, 12, 31)] * 8,
        }
    )
    obs_table = ObservationPeriodTableForTests(
        con.dest_connection.create_table(
            "OBSERVATION_PERIOD",
            df_obs,
            schema={
                "PATID": str,
                "REGSTARTDATE": datetime.date,
                "REGENDDATE": datetime.date,
            },
        )
    )

    # Condition occurrence table (outcome events)
    # outcome_a ("oa"): P0 at day 100, P2 at day 200, P4 at day 300
    # outcome_b ("ob"): P0 at day 50
    df_cond = pd.DataFrame(
        {
            "PATID": ["P0", "P2", "P4", "P0"],
            "MEDCODEID": ["oa", "oa", "oa", "ob"],
            "OBSDATE": [
                index_date + datetime.timedelta(days=100),
                index_date + datetime.timedelta(days=200),
                index_date + datetime.timedelta(days=300),
                index_date + datetime.timedelta(days=50),
            ],
        }
    )
    cond_table = ConditionOccurenceTableForTests(
        con.dest_connection.create_table(
            "CONDITION_OCCURRENCE",
            df_cond,
            schema={
                "PATID": str,
                "MEDCODEID": str,
                "OBSDATE": datetime.date,
            },
        )
    )

    mapped_tables = {
        "PERSON": person_table,
        "DRUG_EXPOSURE": drug_table,
        "OBSERVATION_PERIOD": obs_table,
        "CONDITION_OCCURRENCE": cond_table,
    }

    return cohort, mapped_tables, con


def test_table2_with_real_cohort():
    """
    End-to-end test: build a real cohort, execute it, run Table2, and verify
    incidence rate calculations against hand-computed expected values.
    """
    cohort, mapped_tables, _con = _build_cohort_and_tables()

    # Execute the cohort
    cohort.execute(mapped_tables)

    # Verify cohort index has 8 patients
    index_df = cohort.index_table.to_pandas()
    assert len(index_df) == 8, f"Expected 8 patients in cohort, got {len(index_df)}"

    # Run Table2
    table2 = Table2(time_points=[365])
    results = table2.execute(cohort)

    assert not results.empty, "Table2 should produce results"
    assert len(results) == 2, f"Expected 2 outcome rows, got {len(results)}"

    # ── Validate outcome_a ───────────────────────────────────────────────
    row_a = results[results["Outcome"] == "OUTCOME_A"].iloc[0]

    assert (
        row_a["N_Events"] == 3
    ), f"outcome_a: expected 3 events, got {row_a['N_Events']}"

    # Person-time calculation:
    # P0: 100 days (event at day 100)
    # P1: 365 days (no event)
    # P2: 200 days (event at day 200)
    # P3: 365 days (no event)
    # P4: 300 days (event at day 300)
    # P5: 365 days (no event)
    # P6: 365 days (no event)
    # P7: 365 days (no event)
    # Total = 100 + 200 + 300 + 5*365 = 2425 days
    expected_py_a = 2425 / 365.25
    expected_rate_a = (3 / expected_py_a) * 100

    assert (
        abs(row_a["Time_Under_Risk"] - expected_py_a) < 0.01
    ), f"outcome_a: expected {expected_py_a:.3f} patient-years, got {row_a['Time_Under_Risk']}"
    assert (
        abs(row_a["Incidence_Rate"] - expected_rate_a) < 0.01
    ), f"outcome_a: expected rate {expected_rate_a:.3f}, got {row_a['Incidence_Rate']}"

    # ── Validate outcome_b ───────────────────────────────────────────────
    row_b = results[results["Outcome"] == "OUTCOME_B"].iloc[0]

    assert (
        row_b["N_Events"] == 1
    ), f"outcome_b: expected 1 event, got {row_b['N_Events']}"

    # Person-time calculation:
    # P0: 50 days (event at day 50)
    # P1-P7: 365 days each (no event) = 7*365 = 2555 days
    # Total = 50 + 2555 = 2605 days
    expected_py_b = 2605 / 365.25
    expected_rate_b = (1 / expected_py_b) * 100

    assert (
        abs(row_b["Time_Under_Risk"] - expected_py_b) < 0.01
    ), f"outcome_b: expected {expected_py_b:.3f} patient-years, got {row_b['Time_Under_Risk']}"
    assert (
        abs(row_b["Incidence_Rate"] - expected_rate_b) < 0.01
    ), f"outcome_b: expected rate {expected_rate_b:.3f}, got {row_b['Incidence_Rate']}"


def test_table2_multiple_time_points():
    """
    Test Table2 with multiple time points (90 and 365 days).

    At 90 days:
      outcome_a: P0 event at day 100 is beyond window → 0 events, all 8 patients contribute 90 days
      outcome_b: P0 event at day 50 is within window → 1 event

    At 365 days: same as test_table2_with_real_cohort
    """
    cohort, mapped_tables, _con = _build_cohort_and_tables()
    cohort.execute(mapped_tables)

    table2 = Table2(time_points=[90, 365])
    results = table2.execute(cohort)

    assert (
        len(results) == 4
    ), f"Expected 4 rows (2 outcomes × 2 time points), got {len(results)}"

    # ── outcome_a at 90 days ─────────────────────────────────────────────
    row_a_90 = results[
        (results["Outcome"] == "OUTCOME_A") & (results["Time_Point"] == 90)
    ].iloc[0]

    # No events before day 90 for outcome_a (first event is P0 at day 100)
    assert (
        row_a_90["N_Events"] == 0
    ), f"outcome_a@90d: expected 0 events, got {row_a_90['N_Events']}"

    # All 8 patients contribute 90 days each
    expected_py_a_90 = (8 * 90) / 365.25
    assert (
        abs(row_a_90["Time_Under_Risk"] - expected_py_a_90) < 0.01
    ), f"outcome_a@90d: expected {expected_py_a_90:.3f} py, got {row_a_90['Time_Under_Risk']}"

    # ── outcome_b at 90 days ─────────────────────────────────────────────
    row_b_90 = results[
        (results["Outcome"] == "OUTCOME_B") & (results["Time_Point"] == 90)
    ].iloc[0]

    # P0 has event at day 50
    assert (
        row_b_90["N_Events"] == 1
    ), f"outcome_b@90d: expected 1 event, got {row_b_90['N_Events']}"

    # P0: 50 days, P1-P7: 90 days each = 50 + 7*90 = 680 days
    expected_py_b_90 = 680 / 365.25
    assert (
        abs(row_b_90["Time_Under_Risk"] - expected_py_b_90) < 0.01
    ), f"outcome_b@90d: expected {expected_py_b_90:.3f} py, got {row_b_90['Time_Under_Risk']}"


def test_table2_no_events_outcome():
    """
    Test Table2 with an outcome that has zero events in the cohort.
    """
    cohort, mapped_tables, _con = _build_cohort_and_tables()

    # Add an outcome with a code that no patient has
    outcome_c = CodelistPhenotype(
        name="outcome_c",
        return_date="first",
        codelist=Codelist(["oc_nonexistent"]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
    )
    cohort.add_outcomes([outcome_c])

    cohort.execute(mapped_tables)

    table2 = Table2(time_points=[365], phenotype_names=["OUTCOME_C"])
    results = table2.execute(cohort)

    assert len(results) == 1
    row = results.iloc[0]
    assert row["N_Events"] == 0
    assert row["Incidence_Rate"] == 0.0

    # All 8 patients contribute full 365 days
    expected_py = (8 * 365) / 365.25
    assert abs(row["Time_Under_Risk"] - expected_py) < 0.01


def test_table2_many_events_per_patient():
    """
    Regression test: when a phenotype table has many rows per patient
    (e.g. return_date="all" counting prescriptions), N_Events must still
    count patients-with-events (max = cohort size), NOT total event rows.

    Setup: 8 patients, outcome "oa_all" with return_date="all".
    Condition table has ~50 events per patient for P0, P2, P4 (150 total rows).
    Only the first event per patient matters for Table2.
    """
    index_date = datetime.date(2020, 1, 1)
    patient_ids = [f"P{i}" for i in range(8)]

    con = DuckDBConnector()

    # Person table
    df_person = pd.DataFrame(
        {
            "PATID": patient_ids,
            "YOB": [1980] * 8,
            "GENDER": [1] * 8,
            "ACCEPTABLE": [1] * 8,
        }
    )
    person_table = PersonTableForTests(
        con.dest_connection.create_table(
            "PERSON",
            df_person,
            schema={
                "PATID": str,
                "YOB": int,
                "GENDER": int,
                "ACCEPTABLE": int,
            },
        )
    )

    # Drug exposure (entry codes)
    df_drug = pd.DataFrame(
        {
            "PATID": patient_ids,
            "PRODCODEID": ["d1"] * 8,
            "ISSUEDATE": [index_date] * 8,
        }
    )
    drug_table = DrugExposureTableForTests(
        con.dest_connection.create_table(
            "DRUG_EXPOSURE",
            df_drug,
            schema={
                "PATID": str,
                "PRODCODEID": str,
                "ISSUEDATE": datetime.date,
            },
        )
    )

    # Observation period
    df_obs = pd.DataFrame(
        {
            "PATID": patient_ids,
            "REGSTARTDATE": [datetime.date(2018, 1, 1)] * 8,
            "REGENDDATE": [datetime.date(2021, 12, 31)] * 8,
        }
    )
    obs_table = ObservationPeriodTableForTests(
        con.dest_connection.create_table(
            "OBSERVATION_PERIOD",
            df_obs,
            schema={
                "PATID": str,
                "REGSTARTDATE": datetime.date,
                "REGENDDATE": datetime.date,
            },
        )
    )

    # Condition table: P0, P2, P4 each have ~50 events (many rows per patient)
    # P0: first event at day 100, then every 5 days for 49 more events
    # P2: first event at day 200, then every 3 days for 49 more events
    # P4: first event at day 300, then every 1 day for 49 more events
    cond_rows = []
    for day_offset in range(50):
        cond_rows.append(
            {
                "PATID": "P0",
                "MEDCODEID": "oa_all",
                "OBSDATE": index_date + datetime.timedelta(days=100 + day_offset * 5),
            }
        )
        cond_rows.append(
            {
                "PATID": "P2",
                "MEDCODEID": "oa_all",
                "OBSDATE": index_date + datetime.timedelta(days=200 + day_offset * 3),
            }
        )
        cond_rows.append(
            {
                "PATID": "P4",
                "MEDCODEID": "oa_all",
                "OBSDATE": index_date + datetime.timedelta(days=300 + day_offset),
            }
        )
    df_cond = pd.DataFrame(cond_rows)
    cond_table = ConditionOccurenceTableForTests(
        con.dest_connection.create_table(
            "CONDITION_OCCURRENCE",
            df_cond,
            schema={
                "PATID": str,
                "MEDCODEID": str,
                "OBSDATE": datetime.date,
            },
        )
    )

    mapped_tables = {
        "PERSON": person_table,
        "DRUG_EXPOSURE": drug_table,
        "OBSERVATION_PERIOD": obs_table,
        "CONDITION_OCCURRENCE": cond_table,
    }

    # Use return_date="all" so the phenotype table retains ALL rows per patient
    outcome_all = CodelistPhenotype(
        name="n_prescriptions_followup",
        return_date="all",
        codelist=Codelist(["oa_all"]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
    )

    entry = CodelistPhenotype(
        name="entry",
        return_date="first",
        codelist=Codelist(["d1"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )
    cc = TimeRangePhenotype(
        name="continuous_coverage",
        relative_time_range=RelativeTimeRangeFilter(min_days=GreaterThanOrEqualTo(365)),
    )
    cohort = Cohort(
        name="test_many_events",
        entry_criterion=entry,
        inclusions=[cc],
        outcomes=[outcome_all],
    )
    cohort.execute(mapped_tables)

    # Verify the phenotype table has many rows (not deduplicated)
    outcome_pheno = cohort.outcomes[0]
    outcome_df = outcome_pheno.table.execute()
    assert (
        len(outcome_df) > 8
    ), f"Phenotype table should have many rows per patient, got {len(outcome_df)}"

    # Run Table2
    table2 = Table2(time_points=[365])
    results = table2.execute(cohort)

    assert len(results) == 1
    row = results.iloc[0]

    # N_Events MUST be 3 (patients P0, P2, P4) — NOT 150 (total event rows)
    assert (
        row["N_Events"] == 3
    ), f"N_Events should count patients-with-events (3), not total rows. Got {row['N_Events']}"

    # Person-time: P0=100d, P2=200d, P4=300d, P1/P3/P5/P6/P7=365d each
    # (first event dates: P0@100, P2@200, P4@300)
    expected_py = (100 + 200 + 300 + 5 * 365) / 365.25
    assert (
        abs(row["Time_Under_Risk"] - expected_py) < 0.01
    ), f"Expected {expected_py:.3f} py, got {row['Time_Under_Risk']}"


if __name__ == "__main__":
    test_table2_with_real_cohort()
    test_table2_multiple_time_points()
    test_table2_no_events_outcome()
    test_table2_many_events_per_patient()
    print("All Table2 cohort integration tests passed.")
