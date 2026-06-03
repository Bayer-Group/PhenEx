"""
Tests for Cohort with return_index="first", "last", and "all".

Scenario
--------
Three patients, each with multiple entry events (code "d1") at different dates.
One exclusion criterion (code "e1", before index) selectively removes some
index dates but not others.

Input data
~~~~~~~~~~
Entry events (DRUG_EXPOSURE, code "d1"):
  P1: 2020-01-01, 2020-07-01, 2021-01-01
  P2: 2020-03-01, 2020-09-01
  P3: 2020-05-01

Exclusion events (CONDITION_OCCURRENCE, code "e1"):
  P1: 2020-04-01   →  before 2020-07-01 ✓, before 2021-01-01 ✓, NOT before 2020-01-01
  P3: 2020-03-01   →  before 2020-05-01 ✓

Surviving index dates after exclusion
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  P1: 2020-01-01
  P2: 2020-03-01, 2020-09-01
  P3: (none)

Expected index tables
~~~~~~~~~~~~~~~~~~~~~
  return_index="first":  P1 @ 2020-01-01,  P2 @ 2020-03-01
  return_index="last":   P1 @ 2020-01-01,  P2 @ 2020-09-01
  return_index="all":    P1 @ 2020-01-01,  P2 @ 2020-03-01,  P2 @ 2020-09-01
"""

import datetime
import pandas as pd
from phenex.ibis_connect import DuckDBConnector
from phenex.test.cohort_test_generator import CohortTestGenerator
from phenex.codelists import Codelist
from phenex.core import Cohort
from phenex.phenotypes import CodelistPhenotype
from phenex.filters import RelativeTimeRangeFilter, GreaterThanOrEqualTo
from phenex.test.cohort.test_mappings import (
    PersonTableForTests,
    DrugExposureTableForTests,
    ConditionOccurenceTableForTests,
)


# ---------------------------------------------------------------------------
# Shared data setup
# ---------------------------------------------------------------------------

ENTRY_DATE_1 = datetime.date(2020, 1, 1)
ENTRY_DATE_2 = datetime.date(2020, 7, 1)
ENTRY_DATE_3 = datetime.date(2021, 1, 1)
ENTRY_DATE_4 = datetime.date(2020, 3, 1)
ENTRY_DATE_5 = datetime.date(2020, 9, 1)
ENTRY_DATE_6 = datetime.date(2020, 5, 1)

EXCLUSION_DATE_P1 = datetime.date(2020, 4, 1)
EXCLUSION_DATE_P3 = datetime.date(2020, 3, 1)


def _build_mapped_tables(con):
    """Create shared input tables for all three tests."""
    df_person = pd.DataFrame({
        "PATID": ["P1", "P2", "P3"],
        "YOB": [1980, 1980, 1980],
        "GENDER": [1, 2, 1],
        "ACCEPTABLE": [1, 1, 1],
    })
    person_table = PersonTableForTests(
        con.dest_connection.create_table(
            "PERSON", df_person,
            schema={"PATID": str, "YOB": int, "GENDER": int, "ACCEPTABLE": int},
        )
    )

    df_drug = pd.DataFrame({
        "PATID": ["P1", "P1", "P1", "P2", "P2", "P3"],
        "PRODCODEID": ["d1"] * 6,
        "ISSUEDATE": [
            ENTRY_DATE_1, ENTRY_DATE_2, ENTRY_DATE_3,
            ENTRY_DATE_4, ENTRY_DATE_5,
            ENTRY_DATE_6,
        ],
    })
    drug_table = DrugExposureTableForTests(
        con.dest_connection.create_table(
            "DRUG_EXPOSURE", df_drug,
            schema={"PATID": str, "PRODCODEID": str, "ISSUEDATE": datetime.date},
        )
    )

    df_condition = pd.DataFrame({
        "PATID": ["P1", "P3"],
        "MEDCODEID": ["e1", "e1"],
        "OBSDATE": [EXCLUSION_DATE_P1, EXCLUSION_DATE_P3],
    })
    condition_table = ConditionOccurenceTableForTests(
        con.dest_connection.create_table(
            "CONDITION_OCCURRENCE", df_condition,
            schema={"PATID": str, "MEDCODEID": str, "OBSDATE": datetime.date},
        )
    )

    return {
        "PERSON": person_table,
        "DRUG_EXPOSURE": drug_table,
        "CONDITION_OCCURRENCE": condition_table,
    }


def _make_exclusion():
    return CodelistPhenotype(
        name="prior_event",
        codelist=Codelist(["e1"]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
        relative_time_range=RelativeTimeRangeFilter(
            when="before", min_days=GreaterThanOrEqualTo(0),
        ),
    )


# ---------------------------------------------------------------------------
# return_index = "first"
# ---------------------------------------------------------------------------

class MultiIndexFirstTestGenerator(CohortTestGenerator):
    test_date = True

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="all",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )
        return Cohort(
            name="test_cohort_multi_index_first",
            entry_criterion=entry,
            exclusions=[_make_exclusion()],
            return_index="first",
        )

    def define_mapped_tables(self):
        self.con = DuckDBConnector()
        return _build_mapped_tables(self.con)

    def define_expected_output(self):
        df = pd.DataFrame({
            "PERSON_ID": ["P1", "P2"],
            "EVENT_DATE": [ENTRY_DATE_1, ENTRY_DATE_4],
        })
        return {"index": df}


# ---------------------------------------------------------------------------
# return_index = "last"
# ---------------------------------------------------------------------------

class MultiIndexLastTestGenerator(CohortTestGenerator):
    test_date = True

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="all",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )
        return Cohort(
            name="test_cohort_multi_index_last",
            entry_criterion=entry,
            exclusions=[_make_exclusion()],
            return_index="last",
        )

    def define_mapped_tables(self):
        self.con = DuckDBConnector()
        return _build_mapped_tables(self.con)

    def define_expected_output(self):
        df = pd.DataFrame({
            "PERSON_ID": ["P1", "P2"],
            "EVENT_DATE": [ENTRY_DATE_1, ENTRY_DATE_5],
        })
        return {"index": df}


# ---------------------------------------------------------------------------
# return_index = "all"
# ---------------------------------------------------------------------------

class MultiIndexAllTestGenerator(CohortTestGenerator):
    test_date = True

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="all",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )
        return Cohort(
            name="test_cohort_multi_index_all",
            entry_criterion=entry,
            exclusions=[_make_exclusion()],
            return_index="all",
        )

    def define_mapped_tables(self):
        self.con = DuckDBConnector()
        return _build_mapped_tables(self.con)

    def define_expected_output(self):
        df = pd.DataFrame({
            "PERSON_ID": ["P1", "P2", "P2"],
            "EVENT_DATE": [ENTRY_DATE_1, ENTRY_DATE_4, ENTRY_DATE_5],
        })
        return {"index": df}


# ---------------------------------------------------------------------------
# pytest entry points
# ---------------------------------------------------------------------------

def test_cohort_multi_index_first():
    g = MultiIndexFirstTestGenerator()
    g.run_tests()


def test_cohort_multi_index_last():
    g = MultiIndexLastTestGenerator()
    g.run_tests()


def test_cohort_multi_index_all():
    g = MultiIndexAllTestGenerator()
    g.run_tests()
