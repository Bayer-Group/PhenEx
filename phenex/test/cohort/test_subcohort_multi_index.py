"""
Tests for Subcohort with multi-index dates (return_index="first", "last", "all").

Scenario
--------
Three patients, each with multiple entry events (code "d1") at different dates.
The parent cohort applies an exclusion (code "e1", before index) that removes
some index dates. The subcohort applies an additional exclusion (code "s1",
before index) that further removes specific index dates.

Input data
~~~~~~~~~~
Entry events (DRUG_EXPOSURE, code "d1"):
  P1: 2020-01-01, 2020-07-01, 2021-01-01
  P2: 2020-03-01, 2020-09-01
  P3: 2020-05-01

Cohort exclusion events (CONDITION_OCCURRENCE, code "e1"):
  P1: 2020-04-01  → before 2020-07-01 ✓, before 2021-01-01 ✓, NOT before 2020-01-01
  P3: 2020-03-01  → before 2020-05-01 ✓

Surviving index dates after cohort exclusion
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  P1: 2020-01-01
  P2: 2020-03-01, 2020-09-01
  P3: (none)

Subcohort additional exclusion (DRUG_EXPOSURE, code "s1"):
  P2: 2020-06-01  → before 2020-09-01 ✓, NOT before 2020-03-01

Surviving index dates after subcohort exclusion
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  P1: 2020-01-01
  P2: 2020-03-01   (2020-09-01 removed by s1)

Expected index tables
~~~~~~~~~~~~~~~~~~~~~
  return_index="first":
    Cohort:     P1 @ 2020-01-01,  P2 @ 2020-03-01
    Subcohort:  P1 @ 2020-01-01,  P2 @ 2020-03-01   (s1 not before Mar → P2 stays)

  return_index="last":
    Cohort:     P1 @ 2020-01-01,  P2 @ 2020-09-01
    Subcohort:  P1 @ 2020-01-01                      (s1 before Sep → P2 removed)

  return_index="all":
    Cohort:     P1 @ 2020-01-01,  P2 @ 2020-03-01,  P2 @ 2020-09-01
    Subcohort:  P1 @ 2020-01-01,  P2 @ 2020-03-01   (P2@Sep removed by s1)
"""

import datetime
import pandas as pd
from phenex.ibis_connect import DuckDBConnector
from phenex.test.cohort.test_subcohort import SubcohortTestGenerator
from phenex.codelists import Codelist
from phenex.core import Cohort, Subcohort
from phenex.phenotypes import CodelistPhenotype
from phenex.filters import RelativeTimeRangeFilter, GreaterThanOrEqualTo
from phenex.test.cohort.test_mappings import (
    PersonTableForTests,
    DrugExposureTableForTests,
    ConditionOccurenceTableForTests,
)


# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

ENTRY_DATE_1 = datetime.date(2020, 1, 1)
ENTRY_DATE_2 = datetime.date(2020, 7, 1)
ENTRY_DATE_3 = datetime.date(2021, 1, 1)
ENTRY_DATE_4 = datetime.date(2020, 3, 1)
ENTRY_DATE_5 = datetime.date(2020, 9, 1)
ENTRY_DATE_6 = datetime.date(2020, 5, 1)

EXCLUSION_DATE_P1 = datetime.date(2020, 4, 1)
EXCLUSION_DATE_P3 = datetime.date(2020, 3, 1)

SUBCOHORT_EXCL_DATE_P2 = datetime.date(2020, 6, 1)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _build_mapped_tables(con):
    """Create input tables shared by all three test modes."""
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
        "PATID": ["P1", "P1", "P1", "P2", "P2", "P3", "P2"],
        "PRODCODEID": ["d1", "d1", "d1", "d1", "d1", "d1", "s1"],
        "ISSUEDATE": [
            ENTRY_DATE_1, ENTRY_DATE_2, ENTRY_DATE_3,
            ENTRY_DATE_4, ENTRY_DATE_5,
            ENTRY_DATE_6,
            SUBCOHORT_EXCL_DATE_P2,
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


def _make_cohort_exclusion():
    return CodelistPhenotype(
        name="prior_event",
        codelist=Codelist(["e1"]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
        relative_time_range=RelativeTimeRangeFilter(
            when="before", min_days=GreaterThanOrEqualTo(0),
        ),
    )


def _make_subcohort_exclusion():
    return CodelistPhenotype(
        name="subcohort_excl_s1",
        codelist=Codelist(["s1"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
        relative_time_range=RelativeTimeRangeFilter(
            when="before", min_days=GreaterThanOrEqualTo(0),
        ),
    )


# ---------------------------------------------------------------------------
# return_index = "first"
# ---------------------------------------------------------------------------

class MultiIndexFirstSubcohortTestGenerator(SubcohortTestGenerator):
    test_date = True

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="all",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )
        return Cohort(
            name="test_subcohort_multi_index_first",
            entry_criterion=entry,
            exclusions=[_make_cohort_exclusion()],
            return_index="first",
        )

    def define_subcohort(self):
        return Subcohort(
            name="subcohort",
            cohort=self.cohort,
            exclusions=[_make_subcohort_exclusion()],
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

    def define_expected_subcohort_output(self):
        # s1@June NOT before March → P2 stays
        df = pd.DataFrame({
            "PERSON_ID": ["P1", "P2"],
            "EVENT_DATE": [ENTRY_DATE_1, ENTRY_DATE_4],
        })
        return {"subcohort_index": df}


# ---------------------------------------------------------------------------
# return_index = "last"
# ---------------------------------------------------------------------------

class MultiIndexLastSubcohortTestGenerator(SubcohortTestGenerator):
    test_date = True

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="all",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )
        return Cohort(
            name="test_subcohort_multi_index_last",
            entry_criterion=entry,
            exclusions=[_make_cohort_exclusion()],
            return_index="last",
        )

    def define_subcohort(self):
        return Subcohort(
            name="subcohort",
            cohort=self.cohort,
            exclusions=[_make_subcohort_exclusion()],
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

    def define_expected_subcohort_output(self):
        # s1@June IS before September → P2 removed
        df = pd.DataFrame({
            "PERSON_ID": ["P1"],
            "EVENT_DATE": [ENTRY_DATE_1],
        })
        return {"subcohort_index": df}


# ---------------------------------------------------------------------------
# return_index = "all"
# ---------------------------------------------------------------------------

class MultiIndexAllSubcohortTestGenerator(SubcohortTestGenerator):
    test_date = True

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="all",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )
        return Cohort(
            name="test_subcohort_multi_index_all",
            entry_criterion=entry,
            exclusions=[_make_cohort_exclusion()],
            return_index="all",
        )

    def define_subcohort(self):
        return Subcohort(
            name="subcohort",
            cohort=self.cohort,
            exclusions=[_make_subcohort_exclusion()],
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

    def define_expected_subcohort_output(self):
        # P2@Sep removed by s1; P2@Mar stays
        df = pd.DataFrame({
            "PERSON_ID": ["P1", "P2"],
            "EVENT_DATE": [ENTRY_DATE_1, ENTRY_DATE_4],
        })
        return {"subcohort_index": df}


# ---------------------------------------------------------------------------
# pytest entry points
# ---------------------------------------------------------------------------

def test_subcohort_multi_index_first():
    g = MultiIndexFirstSubcohortTestGenerator()
    g.run_tests()


def test_subcohort_multi_index_last():
    g = MultiIndexLastSubcohortTestGenerator()
    g.run_tests()


def test_subcohort_multi_index_all():
    g = MultiIndexAllSubcohortTestGenerator()
    g.run_tests()
