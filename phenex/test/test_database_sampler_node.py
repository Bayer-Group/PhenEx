"""
Tests for DatabaseSamplerNode.
"""

import datetime

import ibis
import pandas as pd
import pytest

from phenex.core.database_sampler_node import DatabaseSamplerNode
from phenex.node import NodeGroup
from phenex.tables import CodeTable, PhenexPersonTable
from phenex.util.database_sampler import DatabaseSampler

_PERSON_IDS = [1001, 2002, 3003, 4004, 5005, 6006, 7007, 8008, 9009, 1010]
_N = len(_PERSON_IDS)


@pytest.fixture
def sampler_half():
    return DatabaseSampler(fraction=0.5, seed=42)


@pytest.fixture
def tables():
    """10-patient PERSON + CONDITION_OCCURRENCE dataset as ibis memtables."""
    person = PhenexPersonTable(ibis.memtable(pd.DataFrame({"PERSON_ID": _PERSON_IDS})))
    cond = CodeTable(
        ibis.memtable(
            pd.DataFrame(
                {
                    "PERSON_ID": _PERSON_IDS,
                    "EVENT_DATE": [datetime.date(2020, 1, 1)] * _N,
                    "CODE": ["X"] * _N,
                }
            )
        )
    )
    return {"PERSON": person, "CONDITION_OCCURRENCE": cond}


# to_dict()


def test_to_dict_contains_required_keys(sampler_half):
    node = DatabaseSamplerNode(
        name="TEST__SAMPLER_PERSON", domain="PERSON", sampler=sampler_half
    )
    d = node.to_dict()
    for key in ("class_name", "name", "domain", "fraction", "seed"):
        assert key in d, f"Missing key: {key}"


def test_to_dict_values_match_inputs(sampler_half):
    node = DatabaseSamplerNode(
        name="MY_NODE", domain="CONDITION_OCCURRENCE", sampler=sampler_half
    )
    d = node.to_dict()
    assert d["class_name"] == "DatabaseSamplerNode"
    assert d["name"] == "MY_NODE"
    assert d["domain"] == "CONDITION_OCCURRENCE"
    assert d["fraction"] == 0.5
    assert d["seed"] == 42


# ── hash()


def test_hash_changes_when_fraction_changes():
    node_a = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.1, seed=42))
    node_b = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.2, seed=42))
    assert hash(node_a) != hash(node_b)


def test_hash_changes_when_seed_changes():
    node_a = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.5, seed=7))
    node_b = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.5, seed=17))
    assert hash(node_a) != hash(node_b)


def test_hash_is_deterministic():
    node_a = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.5, seed=42))
    node_b = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.5, seed=42))
    assert hash(node_a) == hash(node_b)


def test_hash_changes_when_domain_changes():
    node_a = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.5, seed=42))
    node_b = DatabaseSamplerNode(
        "N", "CONDITION_OCCURRENCE", DatabaseSampler(fraction=0.5, seed=42)
    )
    assert hash(node_a) != hash(node_b)


def test_hash_changes_when_name_changes():
    node_a = DatabaseSamplerNode(
        "NODE_A", "PERSON", DatabaseSampler(fraction=0.5, seed=42)
    )
    node_b = DatabaseSamplerNode(
        "NODE_B", "PERSON", DatabaseSampler(fraction=0.5, seed=42)
    )
    assert hash(node_a) != hash(node_b)


# ── _execute()


def test_execute_returns_none_when_domain_missing(sampler_half, tables):
    node = DatabaseSamplerNode("N", "DRUG_EXPOSURE", sampler_half)
    assert node._execute(tables) is None


def test_execute_returns_none_when_person_missing(sampler_half, tables):
    tables_no_person = {"CONDITION_OCCURRENCE": tables["CONDITION_OCCURRENCE"]}
    node = DatabaseSamplerNode("N", "CONDITION_OCCURRENCE", sampler_half)
    assert node._execute(tables_no_person) is None


def test_execute_returns_none_when_domain_is_none(sampler_half, tables):
    tables_with_none = dict(tables)
    tables_with_none["DRUG_EXPOSURE"] = None
    node = DatabaseSamplerNode("N", "DRUG_EXPOSURE", sampler_half)
    assert node._execute(tables_with_none) is None


def test_execute_fraction_one_is_noop(tables):
    # fraction=1.0 keeps every patient, so the node is a no-op
    node = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=1.0))
    assert node._skip_cache is True
    assert node._execute(tables) is None


def test_skip_cache_only_true_for_fraction_one():
    # Only fraction=1.0 skips the cache (it writes no table)
    assert (
        DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=1.0))._skip_cache
        is True
    )
    assert (
        DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.0))._skip_cache
        is False
    )
    assert (
        DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.1))._skip_cache
        is False
    )


def test_execute_fraction_zero_returns_empty(tables):
    node = DatabaseSamplerNode("N", "PERSON", DatabaseSampler(fraction=0.0))
    result = node._execute(tables)
    assert result is not None
    assert result.table.count().execute() == 0


def test_execute_condition_filtered_to_same_patients_as_person(sampler_half, tables):
    person_node = DatabaseSamplerNode("N_PERSON", "PERSON", sampler_half)
    cond_node = DatabaseSamplerNode("N_COND", "CONDITION_OCCURRENCE", sampler_half)

    person_result = person_node._execute(tables)
    cond_result = cond_node._execute(tables)

    person_ids = set(
        person_result.table.select("PERSON_ID").execute()["PERSON_ID"].tolist()
    )
    cond_ids = set(
        cond_result.table.select("PERSON_ID").execute()["PERSON_ID"].tolist()
    )
    assert cond_ids <= person_ids


def test_execute_preserves_phenex_table_subclass(sampler_half, tables):
    person_node = DatabaseSamplerNode("N_PERSON", "PERSON", sampler_half)
    cond_node = DatabaseSamplerNode("N_COND", "CONDITION_OCCURRENCE", sampler_half)

    assert type(person_node._execute(tables)) is type(tables["PERSON"])
    assert type(cond_node._execute(tables)) is type(tables["CONDITION_OCCURRENCE"])


def test_execute_result_has_correct_columns(sampler_half, tables):
    """Filtered table must have the same columns as the original domain."""
    node = DatabaseSamplerNode("N", "CONDITION_OCCURRENCE", sampler_half)
    result = node._execute(tables)
    assert set(result.table.columns) == set(
        tables["CONDITION_OCCURRENCE"].table.columns
    )


def test_execute_person_domain_returns_partial_sample(tables):
    node = DatabaseSamplerNode(
        "N_PERSON", "PERSON", DatabaseSampler(fraction=0.5, seed=42)
    )
    result = node._execute(tables)

    assert result is not None
    count = result.table.count().execute()
    assert 0 < count < _N, f"Expected partial sample, got {count}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
