import pytest
from phenex.codelists.codelists import Codelist

def test_resolve_use_code_type_true():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.resolve(use_code_type=True)
    expected = {"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]}
    assert resolved.codelist == expected

def test_resolve_use_code_type_false():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.resolve(use_code_type=False)
    expected = {None: ["427.31", "I48.0", "I48.1"]}
    assert list(resolved.codelist.keys()) == [None]
    assert set(resolved.codelist[None]) == set(expected[None])
    
def test_resolve_remove_punctuation():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.resolve(remove_punctuation=True)
    expected = {"ICD-9": ["42731"], "ICD-10": ["I480", "I481"]}
    assert resolved.codelist == expected

def test_resolve_use_code_type_false_remove_punctuation():
    codelist = Codelist({"ICD-9": ["427.31"], "ICD-10": ["I48.0", "I48.1"]})
    resolved = codelist.resolve(use_code_type=False, remove_punctuation=True)
    expected = {None: ["42731", "I480", "I481"]}
    assert list(resolved.codelist.keys()) == [None]
    assert set(resolved.codelist[None]) == set(expected[None])

def test_resolve_empty_codelist():
    codelist = Codelist({})
    resolved = codelist.resolve()
    assert list(resolved.codelist.keys()) == []
