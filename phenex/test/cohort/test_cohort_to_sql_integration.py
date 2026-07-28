import datetime
import glob
import os
import shutil

import pandas as pd
import pytest

from phenex.codelists import Codelist
from phenex.core import Cohort
from phenex.filters import GreaterThanOrEqualTo, RelativeTimeRangeFilter
from phenex.ibis_connect import DuckDBConnector
from phenex.node import Node
from phenex.node_manager import NodeManager
from phenex.phenotypes import CodelistPhenotype, TimeRangePhenotype
from phenex.test.cohort.test_mappings import (
    ConditionOccurenceTableForTests,
    ObservationPeriodTableForTests,
    PersonTableForTests,
)

AF = "I48"
STROKE = "I63"
N_PATIENTS = 8


def _build_tables(con):
    """Create a small deterministic OMOP-ish dataset in the connector's dest DuckDB."""
    patids = [f"P{i}" for i in range(N_PATIENTS)]

    df_person = pd.DataFrame(
        {
            "PATID": patids,
            "YOB": [1960 + i for i in range(N_PATIENTS)],
            "GENDER": [1 if i % 2 else 2 for i in range(N_PATIENTS)],
        }
    )
    person = PersonTableForTests(
        con.dest_connection.create_table(
            "PERSON", df_person, schema={"PATID": str, "YOB": int, "GENDER": int}
        )
    )

    cond_rows = []
    for i, pid in enumerate(patids):
        cond_rows.append(
            {"PATID": pid, "MEDCODEID": AF, "OBSDATE": datetime.date(2020, 1, 1)}
        )
        if i == 0:  # patient 0 has a prior stroke (exclusion)
            cond_rows.append(
                {
                    "PATID": pid,
                    "MEDCODEID": STROKE,
                    "OBSDATE": datetime.date(2019, 1, 1),
                }
            )
    cond = ConditionOccurenceTableForTests(
        con.dest_connection.create_table(
            "CONDITION_OCCURRENCE",
            pd.DataFrame(cond_rows),
            schema={"PATID": str, "MEDCODEID": str, "OBSDATE": datetime.date},
        )
    )

    df_obs = pd.DataFrame(
        {
            "PATID": patids,
            "REGSTARTDATE": [datetime.date(2017, 1, 1)] * N_PATIENTS,
            "REGENDDATE": [datetime.date(2022, 12, 31)] * N_PATIENTS,
        }
    )
    obs = ObservationPeriodTableForTests(
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

    return {
        "PERSON": person,
        "CONDITION_OCCURRENCE": cond,
        "OBSERVATION_PERIOD": obs,
    }


def _build_cohort(name="tosql_cohort", inclusion_min_days=365):
    """A small AF cohort: source-reading entry, a dependency inclusion, a prior-event exclusion."""
    entry = CodelistPhenotype(
        name="entry_af",
        codelist=Codelist([AF]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
        return_date="first",
    )
    inclusion = TimeRangePhenotype(
        name="continuous_coverage",
        relative_time_range=RelativeTimeRangeFilter(
            min_days=GreaterThanOrEqualTo(inclusion_min_days),
            anchor_phenotype=entry,
        ),
    )
    exclusion = CodelistPhenotype(
        name="prior_stroke",
        codelist=Codelist([STROKE]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
        relative_time_range=RelativeTimeRangeFilter(
            when="before",
            min_days=GreaterThanOrEqualTo(0),
            anchor_phenotype=entry,
        ),
    )
    return Cohort(
        name=name,
        entry_criterion=entry,
        inclusions=[inclusion],
        exclusions=[exclusion],
    )


def _con(path):
    """A DuckDB connector whose source == dest (single file), like the mock harness."""
    return DuckDBConnector(DUCKDB_DEST_DATABASE=str(path))


def _sql_files(sql_dir):
    # Node .sql only; exclude codelist sidecars (ibis_pandas_memtable_*.sql).
    return sorted(
        os.path.basename(p)
        for p in glob.glob(os.path.join(sql_dir, "*.sql"))
        if not os.path.basename(p).startswith("ibis_pandas_memtable")
    )


def _reexec_count(con, sql):
    """Re-run a saved SQL string standalone and return its row count."""
    return con.source_connection.sql(sql).count().execute()


def _read(sql_dir, node):
    with open(os.path.join(sql_dir, f"{node.get_table_name()}.sql")) as f:
        return f.read()


class TestCohortToSqlIntegration:
    """Drive real execute() runs, then assert to_sql() behaviour in each real-world state."""

    @pytest.fixture(autouse=True)
    def _isolate_node_manager(self, tmp_path):
        """Give each test its own empty `phenex.db` cache; restored afterwards."""
        prev = Node._node_manager
        Node._node_manager = NodeManager(db_name=str(tmp_path / "phenex.db"))
        yield
        Node._node_manager = prev

    @pytest.fixture
    def artifacts_dir(self, request):
        """Per-test dir under phenex/test/cohort/artifacts/ (gitignored) so generated SQL persists for inspection."""
        d = os.path.join(os.path.dirname(__file__), "artifacts", request.node.name)
        if os.path.exists(d):
            shutil.rmtree(d)
        os.makedirs(d)
        return d

    def _execute(
        self,
        tmp_path,
        artifacts_dir,
        name="tosql_cohort",
        lazy=False,
        sql_dir="__default__",
        con=None,
        inclusion_min_days=365,
    ):
        """Build tables + a fresh cohort and execute once. Returns (cohort, con, sql_dir)."""
        if con is None:
            con = _con(tmp_path / f"{name}.duckdb")
        tables = (
            _build_tables(con)
            if not con.dest_connection.list_tables()
            else {
                "PERSON": PersonTableForTests(con.get_dest_table("PERSON")),
                "CONDITION_OCCURRENCE": ConditionOccurenceTableForTests(
                    con.get_dest_table("CONDITION_OCCURRENCE")
                ),
                "OBSERVATION_PERIOD": ObservationPeriodTableForTests(
                    con.get_dest_table("OBSERVATION_PERIOD")
                ),
            }
        )
        if sql_dir == "__default__":
            sql_dir = os.path.join(artifacts_dir, f"{name}_sql")
        cohort = _build_cohort(name=name, inclusion_min_days=inclusion_min_days)
        cohort.execute(
            tables=tables, con=con, overwrite=True, lazy_execution=lazy, sql_dir=sql_dir
        )
        return cohort, con, sql_dir

    # real runs produce the states

    def test_lazy_execution_writes_sql_files(self, tmp_path, artifacts_dir):
        # A lazy run on a fresh cache writes one non-empty .sql per node.
        cohort, con, sql_dir = self._execute(tmp_path, artifacts_dir, lazy=True)
        expected = {f"{n.get_table_name()}.sql" for n in cohort._collect_all_nodes()}
        assert set(_sql_files(sql_dir)) == expected
        for name in expected:
            body = open(os.path.join(sql_dir, name)).read()
            assert body.strip() and "SELECT" in body.upper()

    # write-control & round-trip fidelity

    def test_sql_dir_none_disables_file_writing(self, tmp_path):
        # sql_dir=None writes no files; to_sql() still works from the in-memory expression (step 1).
        con = _con(tmp_path / "none.duckdb")
        tables = _build_tables(con)
        cohort = _build_cohort()
        would_be_dir = str(tmp_path / "none.duckdb_sql")
        cohort.execute(tables=tables, con=con, overwrite=True, sql_dir=None)
        assert not os.path.isdir(would_be_dir)
        sql = cohort.entry_criterion.to_sql()  # step 1: in-memory expression
        assert isinstance(sql, str) and "SELECT" in sql.upper()

    def test_roundtrip_saved_sql_returns_nonzero_rows(self, tmp_path, artifacts_dir):
        # Re-run each saved .sql standalone; its row count must equal the node's materialized count.
        cohort, con, sql_dir = self._execute(tmp_path, artifacts_dir)
        nodes_by_file = {
            f"{n.get_table_name()}.sql": n for n in cohort._collect_all_nodes()
        }
        entry_file = f"{cohort.entry_criterion.get_table_name()}.sql"
        compared = 0
        for path in glob.glob(os.path.join(sql_dir, "*.sql")):
            node = nodes_by_file.get(os.path.basename(path))
            if (
                node is None or node.table is None
            ):  # coordinator nodes: nothing to re-run
                continue
            saved = open(path).read()
            assert (
                _reexec_count(con, saved) == node.table.count().execute()
            ), f"{node.name}: re-run count != materialized count"
            compared += 1
        assert compared > 0, "no saved .sql files were re-executed"
        assert (
            _reexec_count(con, open(os.path.join(sql_dir, entry_file)).read()) > 0
        ), "entry cohort should return real rows (all patients have AF)"

    def test_standalone_to_sql_matches_saved_file(self, tmp_path, artifacts_dir):
        # standalone node.to_sql() must return exactly what execute(sql_dir=) wrote.
        cohort, con, sql_dir = self._execute(tmp_path, artifacts_dir)
        for node in (cohort.entry_criterion, cohort.index_table_node):
            assert (
                node.to_sql(sql_dir=sql_dir).strip() == _read(sql_dir, node).strip()
            ), f"{node.name}: standalone to_sql() != the .sql file execute() wrote"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
