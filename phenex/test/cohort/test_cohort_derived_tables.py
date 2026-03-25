import datetime
import pytest
import ibis
import pandas as pd
from phenex.core.cohort import Cohort
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.tables import PhenexTable
from phenex.derived_tables import EventsToTimeRange
from phenex.filters.value import LessThanOrEqualTo
from phenex.test.cohort.test_mappings import PersonTableForTests, DrugExposureTableForTests


def _make_tables(con):
    """Create minimal PERSON + DRUG_EXPOSURE tables in the given DuckDB connection."""
    df_person = pd.DataFrame(
        {"PATID": ["P1", "P2"], "YOB": [1980, 1975], "GENDER": [1, 2]}
    )
    person_table = PersonTableForTests(
        con.create_table(
            "PERSON",
            df_person,
            schema={"PATID": str, "YOB": int, "GENDER": int},
        )
    )

    df_drug = pd.DataFrame(
        {
            "PATID": ["P1", "P1", "P2", "P2"],
            "PRODCODEID": ["entry_code", "dt_code", "entry_code", "dt_code"],
            "ISSUEDATE": [
                datetime.date(2020, 1, 1),
                datetime.date(2020, 1, 5),
                datetime.date(2020, 3, 1),
                datetime.date(2020, 3, 5),
            ],
        }
    )
    drug_table = DrugExposureTableForTests(
        con.create_table(
            "DRUG_EXPOSURE",
            df_drug,
            schema={"PATID": str, "PRODCODEID": str, "ISSUEDATE": datetime.date},
        )
    )
    return {"PERSON": person_table, "DRUG_EXPOSURE": drug_table}


def _make_cohort(pre_entry_dt_name, post_entry_dt_name):
    entry = CodelistPhenotype(
        name="entry",
        return_date="first",
        codelist=Codelist(["entry_code"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )

    pre_entry_dt = EventsToTimeRange(
        name=pre_entry_dt_name,
        domain="DRUG_EXPOSURE",
        codelist=Codelist(["dt_code"]).copy(use_code_type=False),
        max_days=LessThanOrEqualTo(30),
    )

    post_entry_dt = EventsToTimeRange(
        name=post_entry_dt_name,
        domain="DRUG_EXPOSURE",
        codelist=Codelist(["dt_code"]).copy(use_code_type=False),
        max_days=LessThanOrEqualTo(30),
    )

    return Cohort(
        name="test_derived_tables_cohort",
        entry_criterion=entry,
        derived_tables=[pre_entry_dt],
        derived_tables_post_entry=[post_entry_dt],
    )


class TestCohortDerivedTableSubsetKeys:
    """Verify that derived table names appear as keys in subset_tables_entry and subset_tables_index."""

    def setup_method(self):
        self.pre_entry_name = "PRE_ENTRY_DT"
        self.post_entry_name = "POST_ENTRY_DT"
        con = ibis.duckdb.connect()
        tables = _make_tables(con)
        cohort = _make_cohort(self.pre_entry_name, self.post_entry_name)
        cohort.execute(tables=tables)

        print("Subset tables entry:", cohort.subset_tables_entry)
        print("Subset tables index:", cohort.subset_tables_index)
        self.cohort = cohort

    def test_pre_entry_derived_table_in_subset_tables_entry(self):
        assert self.pre_entry_name in self.cohort.subset_tables_entry

    def test_post_entry_derived_table_in_subset_tables_entry(self):
        assert self.post_entry_name in self.cohort.subset_tables_entry

    def test_pre_entry_derived_table_in_subset_tables_index(self):
        assert self.pre_entry_name in self.cohort.subset_tables_index


if __name__ == "__main__":
    t = TestCohortDerivedTableSubsetKeys()
    t.setup_method()
    t.test_pre_entry_derived_table_in_subset_tables_entry()
    t.test_post_entry_derived_table_in_subset_tables_entry()
    t.test_pre_entry_derived_table_in_subset_tables_index()