import pandas as pd
import ibis
import pytest

from phenex.derived_tables import LoadTable


def test_load_table_borrows_backend_from_existing_domain():
    con = ibis.duckdb.connect()

    person = con.create_table(
        "PERSON", pd.DataFrame({"PERSON_ID": ["P1", "P2"]})
    )
    lvef = con.create_table(
        "LVEF_ALL_PATIENTS",
        pd.DataFrame({"PERSON_ID": ["P1", "P2"], "LVEF": [55, 30]}),
    )

    node = LoadTable(name="LVEF", table_name="LVEF_ALL_PATIENTS")

    result = node.execute(tables={"PERSON": person})

    assert node.name == "LVEF"
    assert set(result.columns) == {"PERSON_ID", "LVEF"}
    assert result.order_by("PERSON_ID").execute().equals(
        lvef.order_by("PERSON_ID").execute()
    )


def test_load_table_raises_without_existing_domain():
    node = LoadTable(name="LVEF", table_name="LVEF_ALL_PATIENTS")

    with pytest.raises(ValueError):
        node.execute(tables={"EMPTY": None})


def test_load_table_applies_function():
    con = ibis.duckdb.connect()

    person = con.create_table("PERSON", pd.DataFrame({"PERSON_ID": ["P1", "P2"]}))
    con.create_table(
        "LVEF_ALL_PATIENTS",
        pd.DataFrame({"PERSON_ID": ["P1", "P2"], "LVEF": [55, 30]}),
    )

    def filter_low_lvef(t):
        return t.filter(t.LVEF < 50)

    node = LoadTable(
        name="LVEF",
        table_name="LVEF_ALL_PATIENTS",
        function=filter_low_lvef,
    )

    result = node.execute(tables={"PERSON": person}).execute()

    assert list(result["PERSON_ID"]) == ["P2"]


def test_load_table_to_dict_is_json_serializable():
    import json

    def filter_low_lvef(t):
        return t.filter(t.LVEF < 50)

    node = LoadTable(
        name="LVEF",
        table_name="LVEF_ALL_PATIENTS",
        function=filter_low_lvef,
    )

    _dict = node.to_dict()

    assert "function" not in _dict
    assert isinstance(_dict["function_string"], str)
    json.dumps(_dict)  # should not raise


def test_load_table_roundtrips_through_dict():
    con = ibis.duckdb.connect()

    person = con.create_table("PERSON", pd.DataFrame({"PERSON_ID": ["P1", "P2"]}))
    con.create_table(
        "LVEF_ALL_PATIENTS",
        pd.DataFrame({"PERSON_ID": ["P1", "P2"], "LVEF": [55, 30]}),
    )

    def filter_low_lvef(t):
        return t.filter(t.LVEF < 50)

    node = LoadTable(
        name="LVEF",
        table_name="LVEF_ALL_PATIENTS",
        function=filter_low_lvef,
    )

    from phenex.util.serialization.from_dict import from_dict

    reconstructed = from_dict(node.to_dict())

    result = reconstructed.execute(tables={"PERSON": person}).execute()

    assert list(result["PERSON_ID"]) == ["P2"]

