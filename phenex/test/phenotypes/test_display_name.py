import logging

import pytest

from phenex.codelists import Codelist
from phenex.core import Cohort
from phenex.core.reporter_nodes import Table1Node
from phenex.ibis_connect import DuckDBConnector
from phenex.node import Node
from phenex.node_manager import NodeManager
from phenex.phenotypes import CodelistPhenotype, LogicPhenotype
from phenex.test.cohort.test_cohort_lazy_execution import _build_test_tables
from phenex.util.serialization.from_dict import from_dict


def _drug(name, code="d_outcome", **kwargs):
    return CodelistPhenotype(
        name=name,
        codelist=Codelist([code]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
        **kwargs,
    )


def _entry():
    return CodelistPhenotype(
        name="entry",
        return_date="first",
        codelist=Codelist(["d1"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )


def test_label_is_shown_exactly_as_written():
    p = _drug("isth_major_bleed", display_name="ISTH Major Bleeding (v2)")
    assert p.display_name == "ISTH Major Bleeding (v2)"


def test_without_label_the_default_is_unchanged():
    assert _drug("ISTH_Major_bleeding").display_name == "Isth major bleeding"


def test_without_label_to_dict_is_unchanged():
    # keeps the hash of existing studies, so nothing reruns after upgrading
    assert "display_name" not in _drug("x").to_dict()


def test_label_survives_to_dict_and_from_dict():
    p = _drug("x", display_name="My Label")
    assert from_dict(p.to_dict()).display_name == "My Label"


def test_label_does_not_change_phenotype_hash():
    plain, labelled = _drug("x"), _drug("x", display_name="My Label")
    assert plain._get_current_hash() == labelled._get_current_hash()
    assert plain._get_current_hash() != _drug("x", code="other")._get_current_hash()


def test_child_label_does_not_change_parent_hash():
    def parent(label):
        return LogicPhenotype(
            name="bleed",
            expression=_drug("child_1", display_name=label) | _drug("child_2"),
        )

    assert parent(None)._get_current_hash() == parent("Child")._get_current_hash()


def test_label_changes_report_hash():
    def table1_hash(label):
        cohort = Cohort(
            name="c",
            entry_criterion=_entry(),
            characteristics=[_drug("x", display_name=label)],
        )
        return Table1Node(name="T1", cohort=cohort)._get_current_hash()

    assert table1_hash("Old") != table1_hash("New")


def test_label_change_refreshes_report_without_recomputing(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        Node, "_node_manager", NodeManager(db_name=str(tmp_path / "phenex.db"))
    )
    logging.getLogger("phenex").setLevel(logging.WARNING)
    con = DuckDBConnector(DUCKDB_DEST_DATABASE=str(tmp_path / "t.duckdb"))
    tables = _build_test_tables(con)

    def run(label):
        char = _drug("outcome_drug", display_name=label)
        runs = []
        original = char._execute
        char._execute = lambda t: runs.append(1) or original(t)
        cohort = Cohort(name="c", entry_criterion=_entry(), characteristics=[char])
        cohort.execute(tables=tables, con=con, overwrite=True, lazy_execution=True)
        return cohort.table1, len(runs)

    table1, runs = run("Outcome Drug (old)")
    assert runs == 1
    assert table1["Name"].tolist() == ["Cohort", "Outcome Drug (old)"]

    table1, runs = run("Outcome Drug (new)")
    assert runs == 0
    assert table1["Name"].tolist() == ["Cohort", "Outcome Drug (new)"]
