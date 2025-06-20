from collections import UserList
from unittest.mock import MagicMock
import pytest
from deepdiff import DeepDiff


from phenex.codelists.codelists import Codelist


def test_resolve_use_code_type_true():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.copy(use_code_type=True).resolved_codelist
    expected = {"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]}
    assert resolved == expected


def test_resolve_use_code_type_false():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.copy(use_code_type=False).resolved_codelist
    expected = {None: ["427.31", "I48.0", "I48.1"]}
    assert list(resolved.keys()) == [None]
    assert set(resolved[None]) == set(expected[None])


def test_resolve_remove_punctuation():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.copy(remove_punctuation=True).resolved_codelist
    expected = {"ICD-9": ["42731"], "ICD-10": ["I480", "I481"]}
    assert resolved == expected


def test_resolve_use_code_type_false_remove_punctuation():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.copy(
        use_code_type=False, remove_punctuation=True
    ).resolved_codelist
    expected = {None: ["42731", "I480", "I481"]}
    assert list(resolved.keys()) == [None]
    assert set(resolved[None]) == set(expected[None])


def test_resolve_empty_codelist():
    codelist = Codelist({})
    resolved = codelist.copy().resolved_codelist
    assert list(resolved.keys()) == []


def test_codelist_union():
    codelist1 = Codelist({"ICD-9": ["a"], "ICD-10": ["a", "b"]})
    codelist2 = Codelist({"ICD-9": ["b"], "ICD-10": ["c", "d"], "ICD10PCS": ["d"]})
    codelist = codelist1 + codelist2
    resolved = codelist.resolved_codelist
    expected = {"ICD-9": ["a", "b"], "ICD-10": ["a", "b", "c", "d"], "ICD10PCS": ["d"]}
    diff = DeepDiff(resolved, expected, ignore_order=True)
    assert diff == {}


def test_codelist_difference():
    codelist1 = Codelist({"ICD-9": ["a", "b"], "ICD-10": ["a", "b", "c"]})
    codelist2 = Codelist({"ICD-9": ["b", "c"], "ICD-10": ["c", "d"], "ICD10PCS": ["d"]})
    codelist = codelist1 - codelist2
    resolved = codelist.resolved_codelist
    expected = {"ICD-9": ["a"], "ICD-10": ["a", "b"]}
    diff = DeepDiff(resolved, expected, ignore_order=True)
    assert diff == {}


def test_codelist_deletion():
    codelist1 = Codelist({"ICD-9-CM": ["a", "b"], "ICD-10-CM": ["a", "b", "c"]}).copy(
        rename_code_type={"ICD-9-CM": "ICD9CM", "ICD-10-CM": "ICD10CM"}
    )
    resolved = codelist1.resolved_codelist
    expected = {"ICD9CM": ["a", "b"], "ICD10CM": ["a", "b", "c"]}
    diff = DeepDiff(resolved, expected, ignore_order=True)
    assert diff == {}


if __name__ == "__main__":
    test_codelist_union()
