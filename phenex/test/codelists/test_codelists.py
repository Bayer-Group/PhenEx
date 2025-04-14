from collections import UserList
from unittest.mock import MagicMock
import pytest
from deepdiff import DeepDiff


from phenex.codelists.codelists import Codelist, MedConBCodelist


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


def test_codelist_union():
    codelist1 = Codelist({"ICD-9": ["a"], "ICD-10": ["a", "b"]})
    codelist2 = Codelist({"ICD-9": ["b"], "ICD-10": ["c", "d"], "ICD10PCS": ["d"]})
    codelist = codelist1 + codelist2
    resolved = codelist.resolved_codelist
    expected = {"ICD-9": ["a", "b"], "ICD-10": ["a", "b", "c", "d"], "ICD10PCS": ["d"]}
    diff = DeepDiff(resolved, expected, ignore_order=True)
    assert diff == {}


class MedConbCodeset:
    ontology: str
    codes: list[tuple[str, str]]  # code, description


class MedConbCodesets(UserList["MedConbCodeset"]): ...


class MedConbCodelist:
    codesets: "MedConbCodesets"


class TestMedConBCodelist:
    def test_serialization(self):
        medconb_client = MagicMock()

        mock_codelist = MedConbCodelist()
        mock_codelist.codesets = MedConbCodesets()
        mock_codelist.codesets.append(MedConbCodeset())
        mock_codelist.codesets[0].ontology = "ICD-9"
        mock_codelist.codesets[0].codes = [("427.31", "Atrial fibrillation")]
        mock_codelist.codesets.append(MedConbCodeset())
        mock_codelist.codesets[1].ontology = "ICD-10"
        mock_codelist.codesets[1].codes = [
            ("I48.0", "Paroxysmal atrial fibrillation"),
            ("I48.1", "Persistent atrial fibrillation"),
        ]

        medconb_client.get_codelist.return_value = mock_codelist

        want = {
            "class_name": "MedConBCodelist",
            "id": "some-mock-id",
            "name": "codelist_name",
            "remove_punctuation": False,
        }

        codelist = MedConBCodelist(
            "some-mock-id", "codelist_name", medconb_client=medconb_client
        )

        got = codelist.to_dict()

        assert got == want

    def test_populates(self):
        medconb_client = MagicMock()

        mock_codelist = MedConbCodelist()
        mock_codelist.codesets = MedConbCodesets()
        mock_codelist.codesets.append(MedConbCodeset())
        mock_codelist.codesets[0].ontology = "ICD-9"
        mock_codelist.codesets[0].codes = [("427.31", "Atrial fibrillation")]
        mock_codelist.codesets.append(MedConbCodeset())
        mock_codelist.codesets[1].ontology = "ICD-10"
        mock_codelist.codesets[1].codes = [
            ("I48.0", "Paroxysmal atrial fibrillation"),
            ("I48.1", "Persistent atrial fibrillation"),
        ]

        medconb_client.get_codelist.return_value = mock_codelist

        want = {
            "ICD-9": ["427.31"],
            "ICD-10": [
                "I48.0",
                "I48.1",
            ],
        }

        codelist = MedConBCodelist(
            "some-mock-id", "codelist_name", medconb_client=medconb_client
        )
        got = codelist.codelist

        assert got == want


if __name__ == "__main__":
    test_codelist_union()
