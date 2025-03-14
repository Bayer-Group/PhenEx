import pytest
from phenex.codelists.codelists import Codelist


def test_resolve_use_code_type_true():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.resolve(use_code_type=True).resolved_codelist
    expected = {"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]}
    assert resolved == expected


def test_resolve_use_code_type_false():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.resolve(use_code_type=False).resolved_codelist
    expected = {None: ["427.31", "I48.0", "I48.1"]}
    assert list(resolved.keys()) == [None]
    assert set(resolved[None]) == set(expected[None])


def test_resolve_remove_punctuation():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.resolve(remove_punctuation=True).resolved_codelist
    expected = {"ICD-9": ["42731"], "ICD-10": ["I480", "I481"]}
    assert resolved == expected


def test_resolve_use_code_type_false_remove_punctuation():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.resolve(
        use_code_type=False, remove_punctuation=True
    ).resolved_codelist
    expected = {None: ["42731", "I480", "I481"]}
    assert list(resolved.keys()) == [None]
    assert set(resolved[None]) == set(expected[None])


def test_resolve_empty_codelist():
    codelist = Codelist({})
    resolved = codelist.resolve().resolved_codelist
    assert list(resolved.keys()) == []
