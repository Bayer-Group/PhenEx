"""
Tests for the naming rules: top-level phenotypes need different names within
their section, children only within their siblings. Each phenotype's table is
named by its place, e.g. `OUTCOMES__BLEED__CHILD_1`.
"""

import logging

import pytest

from phenex.codelists import Codelist
from phenex.core import Cohort, Subcohort
from phenex.ibis_connect import DuckDBConnector
from phenex.node import Node
from phenex.node_manager import NodeManager
from phenex.phenotypes import CodelistPhenotype, LogicPhenotype
from phenex.test.cohort.test_cohort_lazy_execution import _build_test_tables
from phenex.util.serialization.from_dict import from_dict

# test data: d1 for all 10 persons (entry), d_outcome for 5, e_excl for 2


def _drug(name, code):
    return CodelistPhenotype(
        name=name,
        codelist=Codelist([code]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )


def _entry():
    return CodelistPhenotype(
        name="entry",
        return_date="first",
        codelist=Codelist(["d1"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )


def _bleed(name, code):
    return LogicPhenotype(
        name=name, expression=_drug("child_1", code) | _drug("child_2", "zzz")
    )


def _child(parent, name):
    """A child by name (a LogicPhenotype's children have no fixed order)."""
    return next(c for c in parent.children if c.name == name)


def _persons(phenotype):
    t = phenotype.table
    return t.filter(t.BOOLEAN).PERSON_ID.nunique().execute()


def _count_runs(*phenotypes):
    """Count how often each phenotype computes."""
    runs = {}
    for p in phenotypes:
        runs[id(p)] = 0
        original = p._execute

        def counted(tables, p=p, original=original):
            runs[id(p)] += 1
            return original(tables)

        p._execute = counted
    return runs


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        Node, "_node_manager", NodeManager(db_name=str(tmp_path / "phenex.db"))
    )
    logging.getLogger("phenex").setLevel(logging.WARNING)
    con = DuckDBConnector(DUCKDB_DEST_DATABASE=str(tmp_path / "t.duckdb"))
    return con, _build_test_tables(con)


def _run(cohort, db, lazy=False):
    con, tables = db
    cohort.execute(tables=tables, con=con, overwrite=True, lazy_execution=lazy)


# the rules


def test_same_name_in_two_sections_is_allowed(db):
    char, outcome = _drug("x", "d_outcome"), _drug("x", "e_excl")
    cohort = Cohort(
        name="c", entry_criterion=_entry(), characteristics=[char], outcomes=[outcome]
    )
    _run(cohort, db)
    assert char.get_table_name() == "C__CHARACTERISTICS__X"
    assert outcome.get_table_name() == "C__OUTCOMES__X"
    assert (_persons(char), _persons(outcome)) == (5, 2)


def test_same_name_twice_in_one_section_is_an_error():
    with pytest.raises(ValueError, match='Two inclusions are called "X"'):
        Cohort(
            name="c",
            entry_criterion=_entry(),
            inclusions=[_drug("x", "a"), _drug("x", "b")],
        )


def test_siblings_need_different_names():
    with pytest.raises(ValueError, match='two different children called "CHILD_1"'):
        LogicPhenotype(
            name="bleed", expression=_drug("child_1", "a") | _drug("child_1", "b")
        )


# children with the same name under different parents


def test_children_with_the_same_name_under_two_parents(db):
    bleed, bleed_v2 = _bleed("bleed", "d_outcome"), _bleed("bleed_v2", "e_excl")
    cohort = Cohort(
        name="c", entry_criterion=_entry(), characteristics=[bleed, bleed_v2]
    )
    _run(cohort, db)
    assert (_persons(bleed), _persons(bleed_v2)) == (5, 2)
    names = {c.get_table_name() for c in bleed.children + bleed_v2.children}
    assert names == {
        "C__CHARACTERISTICS__BLEED__CHILD_1",
        "C__CHARACTERISTICS__BLEED__CHILD_2",
        "C__CHARACTERISTICS__BLEED_V2__CHILD_1",
        "C__CHARACTERISTICS__BLEED_V2__CHILD_2",
    }


# lazy execution, load, save


def test_lazy_rerun_computes_nothing(db):
    def phenotypes():
        bleed, bleed_v2 = _bleed("bleed", "d_outcome"), _bleed("bleed_v2", "e_excl")
        cohort = Cohort(name="c", entry_criterion=_entry(), outcomes=[bleed, bleed_v2])
        return cohort, [bleed, bleed_v2] + bleed.children + bleed_v2.children

    cohort, _ = phenotypes()
    _run(cohort, db, lazy=True)
    # a fresh session: two different CHILD_1s must not overwrite each other's saved state
    cohort, all_phenotypes = phenotypes()
    runs = _count_runs(*all_phenotypes)
    _run(cohort, db, lazy=True)
    assert set(runs.values()) == {0}


def test_load_falls_back_to_names_from_older_runs(db):
    con, _ = db
    _run(
        Cohort(
            name="c",
            entry_criterion=_entry(),
            characteristics=[_drug("x", "d_outcome")],
        ),
        db,
    )
    # what a run before this change wrote
    con.dest_connection.raw_sql('ALTER TABLE "C__CHARACTERISTICS__X" RENAME TO "C__X"')
    x = _drug("x", "d_outcome")
    Cohort(name="c", entry_criterion=_entry(), characteristics=[x]).load(con=con)
    assert _persons(x) == 5


def test_save_and_load_keeps_children_with_the_same_name_apart():
    cohort = Cohort(
        name="c",
        entry_criterion=_entry(),
        characteristics=[_bleed("bleed", "a"), _bleed("bleed_v2", "b")],
    )
    loaded = from_dict(cohort.to_dict())
    bleed, bleed_v2 = loaded.characteristics
    child_1, child_1_v2 = _child(bleed, "CHILD_1"), _child(bleed_v2, "CHILD_1")
    assert child_1 is not child_1_v2
    assert child_1.unique_name == "CHARACTERISTICS__BLEED__CHILD_1"
    assert child_1_v2.unique_name == "CHARACTERISTICS__BLEED_V2__CHILD_1"


# reports and subcohorts


def test_detailed_table1_puts_each_child_under_its_parent(db):
    cohort = Cohort(
        name="c",
        entry_criterion=_entry(),
        characteristics=[_bleed("bleed", "d_outcome"), _bleed("bleed_v2", "e_excl")],
    )
    _run(cohort, db)
    df = cohort._report_df(cohort.table1_detailed_node, "table1_detailed")
    # group the rows under their parent (children are indented)
    groups = {}
    for name, n in list(zip(df["Name"], df["N"]))[1:]:
        if name == name.strip():
            parent = groups.setdefault(name, {})
        else:
            parent[name.strip()] = int(n)
    assert groups == {
        "Bleed": {"Child 1": 5, "Child 2": 0},
        "Bleed v2": {"Child 1": 2, "Child 2": 0},
    }


def test_subcohort_keeps_the_parent_names(db):
    # one child under a characteristic and an outcome; a subcohort has no
    # characteristics, so building it renames the child until the parent restores it
    shared = _drug("shared", "d_outcome")
    char = LogicPhenotype(name="char_p", expression=shared | _drug("c2", "zzz"))
    out = LogicPhenotype(name="out_p", expression=shared | _drug("o2", "zzz"))
    parent = Cohort(
        name="c", entry_criterion=_entry(), characteristics=[char], outcomes=[out]
    )
    extra = _drug("shared", "e_excl")  # same name as the parent's child: allowed
    sub = Subcohort(name="sub", cohort=parent, inclusions=[extra])
    assert shared.unique_name == "CHARACTERISTICS__CHAR_P__SHARED"
    assert extra.unique_name == "INCLUSIONS__SHARED"

    con, tables = db
    _run(parent, db)
    sub.execute(tables=tables, con=con, overwrite=True)
    assert sub.index_table.count().execute() == 2
    assert shared.get_table_name() == "C__CHARACTERISTICS__CHAR_P__SHARED"
