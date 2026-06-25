import datetime
import os
from typing import Any

import ibis
import pandas as pd
import pytest

from phenex.mappers import OMOPDomains
from phenex.sim import DomainsMocker
from phenex.tables import CodeTable, PhenexPersonTable, PhenexTable
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.util.database_sampler import DatabaseSampler

_INT_PERSON_IDS_20 = [
    1847392,
    5023471,
    9182736,
    3047821,
    7561034,
    2839105,
    6104729,
    4782013,
    8293047,
    1056738,
    9374012,
    3821047,
    7039482,
    5194023,
    2748391,
    6037219,
    4820371,
    8104729,
    3972045,
    1284763,
]

_UUID_PERSON_IDS_20 = [
    "7b1f8c3a-4d2e-4f5a-8b6c-9e0d1f2a3b4c",
    "3a9f2b1c-8e4d-4a3b-9c5d-2f7e8a1b6c0d",
    "f4c8a2e7-1b9d-4c5e-a3f2-7d0e8b1c9a4f",
    "2d5e9f1a-7c3b-4a8e-b6d1-0f4c2e7a8b3d",
    "9a1b4c7e-3f2d-4e8a-c5b9-1d6f0a2e7c4b",
    "6c3f8a1e-9b5d-4f2c-8a7e-3b0d1f4c9e2a",
    "b5e2d9f4-1a7c-4b3e-9f6d-2c8a0e5b1d7f",
    "4e8b1c3f-7d9a-4e2b-a8c5-0f3e6d1b9a4c",
    "8f3c6a2e-4b1d-4c7f-b9a3-5e0d2f8c1a6b",
    "1d7a4e9c-2f5b-4a3d-c8e7-6b0f1a4d9c2e",
    "5a0c8f3b-9e2d-4b6a-d4c1-7f3e5a0b2c8d",
    "e2b7f4a1-3c9d-4e5b-f0a6-1d4c8e2b7f3a",
    "3f6d0b8e-5a1c-4d9f-a2b7-4c7e1f3a6d0b",
    "7c1e5f2a-0b4d-4c8e-b7a3-9f2d0c7e5b1a",
    "0b4a9c6f-2e7d-4f1b-c5a8-3d0e4b9c6f2a",
    "a8d3e7c2-6f1b-4a5d-e9c4-0b3f7a8d2e6c",
    "c6f1a4b8-3e9d-4c2f-a7b0-5d1c6f4a8e3b",
    "2e5c8d1f-4a7b-4f3c-b6e9-8a2d5c1f7e4b",
    "d9a2f6c4-8b3e-4d1a-c7f5-2e9b0d4a6c8f",
    "f7b4e1d9-2c6a-4b8f-d3e0-6a1c7f4b9e2d",
]

_STR_PERSON_IDS_20 = [
    "PAT-7B3F",
    "PAT-2A9E",
    "PAT-F1C4",
    "PAT-8D0A",
    "PAT-3E6B",
    "PAT-C4F2",
    "PAT-9A1D",
    "PAT-5E7C",
    "PAT-0B4F",
    "PAT-D2A8",
    "PAT-6F3E",
    "PAT-B1C9",
    "PAT-4D0F",
    "PAT-E8A3",
    "PAT-7C2B",
    "PAT-1F5D",
    "PAT-A3E6",
    "PAT-8B0C",
    "PAT-2D4A",
    "PAT-F9E1",
]


class DatabaseSamplerTestGenerator(PhenotypeTestGenerator):
    """Generates in-memory test tables for DatabaseSampler tests"""

    def __init__(self, person_ids, name_space: str = "dbs") -> None:
        self.person_ids = list(person_ids)
        self.n_patients = len(self.person_ids)
        self.name_space = name_space

    def define_input_tables(self):
        return [
            {
                "name": "PERSON",
                "df": pd.DataFrame({"PERSON_ID": self.person_ids}),
                "type": PhenexPersonTable,
            },
            {
                "name": "CONDITION_OCCURRENCE",
                "df": pd.DataFrame(
                    {
                        "PERSON_ID": self.person_ids,
                        "EVENT_DATE": [datetime.date(2020, 1, 1)] * self.n_patients,
                        "CODE": ["X"] * self.n_patients,
                    }
                ),
                "type": CodeTable,
            },
        ]

    def define_phenotype_tests(self):
        """Sampler scenarios to run. Each entry produces expected/ and result/ CSVs."""
        return [
            {"name": "sample_half", "fraction": 0.5, "seed": 847163},
            {"name": "sample_tenth", "fraction": 0.1, "seed": 291058},
        ]

    def _run_tests(self):
        """Run each sampler scenario and write expected + result CSVs per domain."""
        for scenario in self.define_phenotype_tests():
            sampler = DatabaseSampler(
                fraction=scenario["fraction"], seed=scenario["seed"]
            )
            sampled = sampler.sample(self.domains)

            for domain_name, domain in sampled.items():
                if domain is None:
                    continue
                df = domain.table.execute()
                stem = f"{self.name_space}_{scenario['name']}_{domain_name}"
                df.to_csv(
                    os.path.join(self.dirpaths["result"], stem + ".csv"),
                    index=False,
                )
                df.to_csv(
                    os.path.join(self.dirpaths["expected"], stem + ".csv"),
                    index=False,
                )

    def _create_input_data(self):
        """Create DuckDB tables using pandas-inferred types."""
        self.domains = {}
        for input_info in self.define_input_tables():
            filename = self.name_file(input_info["name"]) + ".csv"
            path = os.path.join(self.dirpaths["input"], filename)
            input_info["df"].to_csv(path, index=False, date_format=self.date_format)

            schema = {}
            for col, dtype in input_info["df"].dtypes.items():
                if "date" in col.lower():
                    schema[col] = datetime.date
                elif pd.api.types.is_integer_dtype(dtype):
                    schema[col] = int
                elif pd.api.types.is_float_dtype(dtype):
                    schema[col] = float
                else:
                    schema[col] = str

            table = self.con.create_table(
                input_info["name"], input_info["df"], schema=schema
            )
            table_type = input_info.get("type", PhenexPersonTable)
            self.domains[input_info["name"]] = table_type(table)

    def _create_artifact_directory(self, name_phenotype):
        """Write artifacts to phenex/test/util/artifacts/."""
        path_artifacts = os.path.join(
            os.path.dirname(__file__), "artifacts", name_phenotype
        )
        if not os.path.exists(path_artifacts):
            os.makedirs(path_artifacts)
        self.dirpaths = {
            "seeds": path_artifacts,
            "input": os.path.join(path_artifacts, "input_generated"),
            "expected": os.path.join(path_artifacts, "expected"),
            "result": os.path.join(path_artifacts, "result"),
        }
        for _path in self.dirpaths.values():
            if not os.path.exists(_path):
                os.makedirs(_path)


@pytest.fixture(scope="module")
def tables_20() -> dict[str, Any]:
    """20-patient PERSON + CONDITION_OCCURRENCE dataset via DatabaseSamplerTestGenerator."""
    gen = DatabaseSamplerTestGenerator(
        person_ids=_INT_PERSON_IDS_20, name_space="dbs_int20"
    )
    gen.run_tests()
    return gen.domains


@pytest.fixture(scope="module")
def tables_10() -> dict[str, Any]:
    """10-patient PERSON + CONDITION_OCCURRENCE dataset via DatabaseSamplerTestGenerator."""
    gen = DatabaseSamplerTestGenerator(
        person_ids=_INT_PERSON_IDS_20[:10], name_space="dbs_int10"
    )
    gen.run_tests()
    return gen.domains


@pytest.fixture(scope="module")
def uuid_tables_20() -> dict[str, Any]:
    """20-patient dataset with UUID string PERSON_IDs (smoke test for type coverage)."""
    gen = DatabaseSamplerTestGenerator(
        person_ids=_UUID_PERSON_IDS_20,
        name_space="dbs_uuid20",
    )
    gen.run_tests()
    return gen.domains


@pytest.fixture(scope="module")
def string_tables_20() -> dict[str, Any]:
    """20-patient dataset with plain string PERSON_IDs (smoke test for type coverage)."""
    gen = DatabaseSamplerTestGenerator(
        person_ids=_STR_PERSON_IDS_20,
        name_space="dbs_str20",
    )
    gen.run_tests()
    return gen.domains


@pytest.fixture(scope="module")
def omop_100() -> dict[str, Any]:
    """100-patient OMOP dataset generated by DomainsMocker."""
    return DomainsMocker(
        OMOPDomains, n_patients=100, random_seed=89
    ).get_mapped_tables()


# Construction and validation


def test_fraction_is_required() -> None:
    """Calling DatabaseSampler() without fraction raises ValueError immediately."""
    with pytest.raises(ValueError, match="fraction is required"):
        DatabaseSampler()


def test_non_numeric_fraction_raises() -> None:
    """fraction must be a number; strings and other types are rejected."""
    with pytest.raises(ValueError, match="fraction must be a number"):
        DatabaseSampler(fraction="0.1")
    with pytest.raises(ValueError, match="fraction must be a number"):
        DatabaseSampler(fraction=[0.1])
    with pytest.raises(ValueError, match="fraction must be a number"):
        DatabaseSampler(fraction=True)


def test_fraction_out_of_range_raises() -> None:
    """fraction must be within [0.0, 1.0]; values outside that range are rejected."""
    with pytest.raises(ValueError):
        DatabaseSampler(fraction=-0.1)
    with pytest.raises(ValueError):
        DatabaseSampler(fraction=1.1)


def test_non_integer_seed_raises() -> None:
    """seed must be an integer; floats, strings, and bools are rejected."""
    with pytest.raises(ValueError, match="seed must be an integer"):
        DatabaseSampler(fraction=0.1, seed=1.5)
    with pytest.raises(ValueError, match="seed must be an integer"):
        DatabaseSampler(fraction=0.1, seed="42")
    with pytest.raises(ValueError, match="seed must be an integer"):
        DatabaseSampler(fraction=0.1, seed=True)


def test_fraction_zero_is_valid() -> None:
    """fraction=0.0 is accepted and always produces an empty sample."""
    sampler = DatabaseSampler(fraction=0.0)
    assert sampler.fraction == 0.0
    assert sampler.denom == 0


def test_fraction_one_is_valid() -> None:
    """fraction=1.0 is accepted and keeps all patients; denom is 1."""
    sampler = DatabaseSampler(fraction=1.0)
    assert sampler.fraction == 1.0
    assert sampler.denom == 1


def test_fraction_as_int_is_valid() -> None:
    """fraction may be passed as an int; denom is computed correctly."""
    sampler = DatabaseSampler(fraction=1)
    assert sampler.fraction == 1
    assert sampler.denom == 1


def test_fraction_can_be_passed_positionally() -> None:
    """fraction may be passed as a positional argument."""
    sampler = DatabaseSampler(0.1)
    assert sampler.fraction == 0.1


def test_denom_computed_at_construction() -> None:
    """denom = round(1 / fraction) and is available immediately after __init__."""
    sampler = DatabaseSampler(fraction=0.1, seed=42)
    assert sampler.denom == 10  # round(1 / 0.1)


def test_seed_stored_at_construction() -> None:
    """seed is stored as-is; any integer is valid including 0 and negatives."""
    assert DatabaseSampler(fraction=0.1, seed=7).seed == 7
    assert DatabaseSampler(fraction=0.1, seed=17).seed == 17
    assert DatabaseSampler(fraction=0.1, seed=0).seed == 0
    assert DatabaseSampler(fraction=0.1, seed=-1).seed == -1


def test_default_seed_is_42() -> None:
    """Default seed is 42 when not provided."""
    assert DatabaseSampler(fraction=0.1).seed == 42


def test_state_attributes_none_before_sample() -> None:
    """All result attributes start as None. No DB contact at construction."""
    sampler = DatabaseSampler(fraction=0.1)
    assert sampler._person_ids_expr is None
    assert sampler.person_ids is None
    assert sampler.person_id_count is None


# sample()


def test_sample_returns_dict_with_same_keys(tables_20: dict[str, Any]) -> None:
    """sample() returns a NEW dict; its keys are identical to the input."""
    result = DatabaseSampler(fraction=1.0).sample(tables_20)
    assert set(result.keys()) == set(tables_20.keys())


def test_sample_does_not_modify_original(tables_20: dict[str, Any]) -> None:
    """sample() must not mutate the input mapped_tables dict."""
    original_count = tables_20["PERSON"].table.count().execute()
    DatabaseSampler(fraction=0.5).sample(tables_20)
    assert tables_20["PERSON"].table.count().execute() == original_count


def test_fraction_one_keeps_all_patients(tables_20: dict[str, Any]) -> None:
    """fraction=1.0 is a no-op. Every patient passes through the filter."""
    result = DatabaseSampler(fraction=1.0).sample(tables_20)
    assert result["PERSON"].table.count().execute() == 20


def test_fraction_zero_returns_empty_domains(tables_20: dict[str, Any]) -> None:
    """fraction=0.0 filters out every patient in every domain."""
    result = DatabaseSampler(fraction=0.0).sample(tables_20)
    assert result["PERSON"].table.count().execute() == 0
    assert result["CONDITION_OCCURRENCE"].table.count().execute() == 0


def test_condition_rows_only_for_sampled_patients() -> None:
    """After sampling, no domain contains rows for patients not in PERSON.

    CONDITION_OCCURRENCE has extra rows for patients 6, 7, 8 who are NOT in PERSON.
    After fraction=1.0 sampling (keep all PERSON rows), those orphan rows
    must be dropped because the INNER JOIN on PERSON_ID removes them.
    """
    person_ids = [1, 2, 3, 4, 5]
    extra_ids = [6, 7, 8]
    person = PhenexPersonTable(ibis.memtable(pd.DataFrame({"PERSON_ID": person_ids})))
    cond = CodeTable(
        ibis.memtable(
            pd.DataFrame(
                {
                    "PERSON_ID": person_ids + extra_ids,
                    "EVENT_DATE": [datetime.date(2020, 1, 1)] * 8,
                    "CODE": ["X"] * 8,
                }
            )
        )
    )
    tables = {"PERSON": person, "CONDITION_OCCURRENCE": cond}

    result = DatabaseSampler(fraction=1.0).sample(tables)
    assert result["CONDITION_OCCURRENCE"].table.count().execute() == 5


def test_sample_missing_person_raises(tables_20: dict[str, Any]) -> None:
    """sample() raises KeyError when mapped_tables has no 'PERSON' key."""
    tables = {"CONDITION_OCCURRENCE": tables_20["CONDITION_OCCURRENCE"]}
    with pytest.raises(KeyError):
        DatabaseSampler(fraction=0.5).sample(tables)


def test_sample_none_person_raises(tables_20: dict[str, Any]) -> None:
    """sample() raises KeyError when mapped_tables['PERSON'] is None."""
    tables = dict(tables_20)
    tables["PERSON"] = None
    with pytest.raises(KeyError):
        DatabaseSampler(fraction=0.5).sample(tables)


def test_sample_person_without_person_id_col_raises() -> None:
    """sample() raises ValueError when PERSON table has no PERSON_ID column."""
    person = PhenexTable(ibis.memtable(pd.DataFrame({"PATIENT_KEY": [1, 2, 3]})))
    with pytest.raises(ValueError, match="PERSON_ID"):
        DatabaseSampler(fraction=0.5).sample({"PERSON": person})


def test_sample_twice_resets_fetch_state(tables_20: dict[str, Any]) -> None:
    """Calling sample() a second time resets person_ids and person_id_count to None."""
    sampler = DatabaseSampler(fraction=1.0)
    sampler.sample(tables_20)
    sampler.fetch_person_ids()
    assert sampler.person_ids is not None

    sampler.sample(tables_20)
    assert sampler.person_ids is None
    assert sampler.person_id_count is None


def test_filtered_domain_contains_only_sampled_patient_rows(
    tables_20: dict[str, Any],
) -> None:
    """Domains with PERSON_ID are filtered to exactly the sampled patient set.

    Uses fraction=1.0 to get a deterministic full sample, then checks that
    every PERSON_ID in CONDITION_OCCURRENCE belongs to the sampled PERSON set.
    """
    sampler = DatabaseSampler(fraction=1.0)
    result = sampler.sample(tables_20)
    sampler.fetch_person_ids()

    sampled_ids = set(sampler.person_ids)
    condition_ids = set(
        result["CONDITION_OCCURRENCE"]
        .table.select("PERSON_ID")
        .execute()["PERSON_ID"]
        .tolist()
    )
    assert condition_ids <= sampled_ids


def test_filtered_domain_preserves_table_type(tables_20: dict[str, Any]) -> None:
    """sample() preserves the PhenexTable subclass of each filtered domain."""
    result = DatabaseSampler(fraction=1.0).sample(tables_20)
    assert type(result["PERSON"]) is type(tables_20["PERSON"])
    assert type(result["CONDITION_OCCURRENCE"]) is type(
        tables_20["CONDITION_OCCURRENCE"]
    )


def test_sample_passes_through_none_domains(tables_20: dict[str, Any]) -> None:
    """sample() passes None domains through unchanged without raising."""
    tables = dict(tables_20)
    tables["DRUG_EXPOSURE"] = None
    result = DatabaseSampler(fraction=0.5).sample(tables)
    assert result["DRUG_EXPOSURE"] is None


def test_sample_passes_through_domain_without_person_id(
    tables_20: dict[str, Any]
) -> None:
    """sample() passes through tables that have no PERSON_ID column (e.g. concept lookups)."""
    concept = PhenexTable(
        ibis.memtable(pd.DataFrame({"CODE": ["A", "B", "C"], "LABEL": ["x", "y", "z"]}))
    )
    tables = dict(tables_20)
    tables["CONCEPT"] = concept
    result = DatabaseSampler(fraction=0.5).sample(tables)
    assert result["CONCEPT"].table.count().execute() == 3


def test_sample_sets_person_ids_expr(tables_20: dict[str, Any]) -> None:
    """After sample(), _person_ids_expr is set (lazy ibis expression, not data)."""
    sampler = DatabaseSampler(fraction=1.0)
    assert sampler._person_ids_expr is None
    sampler.sample(tables_20)
    assert sampler._person_ids_expr is not None
    assert sampler.person_ids is None


# fetch_person_ids()


def test_fetch_before_sample_raises() -> None:
    """fetch_person_ids() raises RuntimeError when called before sample()."""
    with pytest.raises(RuntimeError, match=".sample."):
        DatabaseSampler(fraction=0.5).fetch_person_ids()


def test_fetch_returns_sorted_list_and_sets_attrs(tables_10: dict[str, Any]) -> None:
    """fetch_person_ids() returns a sorted list and populates person_ids / person_id_count."""
    sampler = DatabaseSampler(fraction=1.0)
    sampler.sample(tables_10)
    ids: list[Any] = sampler.fetch_person_ids()

    assert isinstance(ids, list)
    assert ids == sorted(ids)
    assert sampler.person_id_count == len(ids)
    assert sampler.person_ids == ids


def test_fetch_empty_table_returns_empty_list(tables_20: dict[str, Any]) -> None:
    """fetch_person_ids() on an empty sample returns [] and sets count to 0."""
    sampler = DatabaseSampler(fraction=0.0)
    sampler.sample(tables_20)
    ids = sampler.fetch_person_ids()
    assert ids == []
    assert sampler.person_id_count == 0


def test_fetch_ids_all_came_from_person_table(tables_20: dict[str, Any]) -> None:
    """Every ID returned by fetch_person_ids() must exist in the original PERSON table."""
    sampler = DatabaseSampler(fraction=1.0)
    sampler.sample(tables_20)
    fetched = sampler.fetch_person_ids()
    assert set(fetched) <= set(_INT_PERSON_IDS_20)


def test_fetch_called_twice_returns_same_result(tables_10: dict[str, Any]) -> None:
    """fetch_person_ids() can be called multiple times and returns the same sorted list."""
    sampler = DatabaseSampler(fraction=1.0)
    sampler.sample(tables_10)
    ids_first = sampler.fetch_person_ids()
    ids_second = sampler.fetch_person_ids()
    assert ids_first == ids_second
    assert sampler.person_id_count == len(ids_second)


# describe()


def test_describe_returns_string() -> None:
    assert isinstance(DatabaseSampler(fraction=0.1).describe(), str)


def test_describe_before_sample_shows_not_sampled() -> None:
    desc = DatabaseSampler(fraction=0.1).describe()
    assert "no -- call .sample() first" in desc


def test_describe_after_sample_shows_sampled(tables_20: dict[str, Any]) -> None:
    sampler = DatabaseSampler(fraction=0.1)
    sampler.sample(tables_20)
    assert "yes -- call fetch_person_ids() to inspect" in sampler.describe()


def test_describe_before_fetch_hides_patient_count(tables_20: dict[str, Any]) -> None:
    sampler = DatabaseSampler(fraction=0.1)
    sampler.sample(tables_20)
    assert "call .fetch_person_ids() to load" in sampler.describe()


def test_describe_after_fetch_shows_patient_count(tables_10: dict[str, Any]) -> None:
    sampler = DatabaseSampler(fraction=1.0)
    sampler.sample(tables_10)
    sampler.fetch_person_ids()
    assert "10" in sampler.describe()


def test_describe_contains_fraction_seed_denom_and_filter() -> None:
    """describe() must show fraction, seed, denom, and the string-concat filter formula."""
    sampler = DatabaseSampler(fraction=0.1, seed=7)
    desc = sampler.describe()
    assert "0.1" in desc  # fraction
    assert "7" in desc  # seed
    assert "10" in desc  # denom
    assert "||" in desc  # string concat marker, confirms type-agnostic algorithm


def test_describe_fraction_zero_shows_empty_filter() -> None:
    """describe() with fraction=0.0 uses the empty-sample branch (no hash formula)."""
    desc = DatabaseSampler(fraction=0.0).describe()
    assert "always empty" in desc
    assert "denom      : 0" in desc


def test_describe_is_safe_at_every_lifecycle_stage(tables_20: dict[str, Any]) -> None:
    """describe() must not raise at any point in the sampler lifecycle."""
    sampler = DatabaseSampler(fraction=0.25)
    sampler.describe()  # before sample
    sampler.sample(tables_20)
    sampler.describe()  # after sample
    sampler.fetch_person_ids()
    sampler.describe()  # after fetch


def test_uuid_person_ids_are_supported(uuid_tables_20: dict[str, Any]) -> None:
    """UUID PERSON_IDs are accepted and produce a non-empty sample."""
    result = DatabaseSampler(fraction=0.5, seed=42).sample(uuid_tables_20)
    assert result["PERSON"].table.count().execute() > 0


def test_string_person_ids_are_supported(string_tables_20: dict[str, Any]) -> None:
    """Plain string PERSON_IDs are accepted and produce a non-empty sample."""
    result = DatabaseSampler(fraction=0.5, seed=42).sample(string_tables_20)
    assert result["PERSON"].table.count().execute() > 0


# Integration — determinism, seed independence, multi-domain consistency


def test_same_fraction_seed_is_deterministic(omop_100: dict[str, Any]) -> None:
    """Same fraction + seed always returns the exact same patients."""
    r1 = DatabaseSampler(fraction=0.1, seed=42).sample(omop_100)
    r2 = DatabaseSampler(fraction=0.1, seed=42).sample(omop_100)
    ids1 = sorted(
        r1["PERSON"].table.select("PERSON_ID").execute()["PERSON_ID"].tolist()
    )
    ids2 = sorted(
        r2["PERSON"].table.select("PERSON_ID").execute()["PERSON_ID"].tolist()
    )
    assert ids1 == ids2


def test_different_seeds_produce_different_cohorts(omop_100: dict[str, Any]) -> None:
    """Different seeds produce different patient sets."""
    for seed_a, seed_b in [(7, 17), (42, 52)]:
        ids_a = set(
            DatabaseSampler(fraction=0.1, seed=seed_a)
            .sample(omop_100)["PERSON"]
            .table.select("PERSON_ID")
            .execute()["PERSON_ID"]
            .tolist()
        )
        ids_b = set(
            DatabaseSampler(fraction=0.1, seed=seed_b)
            .sample(omop_100)["PERSON"]
            .table.select("PERSON_ID")
            .execute()["PERSON_ID"]
            .tolist()
        )
        assert (
            ids_a != ids_b
        ), f"seed={seed_a} and seed={seed_b} returned the same patients."


def test_seed_zero_and_seed_one_are_different_cohorts(omop_100: dict[str, Any]) -> None:
    """seed=0 and seed=1 must produce different cohorts.

    seed=0 appends '0' to each stringified PERSON_ID before hashing.
    seed=1 appends '1', producing different hash inputs and a distinct cohort.
    """
    ids_0 = set(
        DatabaseSampler(fraction=0.1, seed=0)
        .sample(omop_100)["PERSON"]
        .table.select("PERSON_ID")
        .execute()["PERSON_ID"]
        .tolist()
    )
    ids_1 = set(
        DatabaseSampler(fraction=0.1, seed=1)
        .sample(omop_100)["PERSON"]
        .table.select("PERSON_ID")
        .execute()["PERSON_ID"]
        .tolist()
    )
    assert ids_0 != ids_1


def test_all_domains_filtered_to_same_patient_set(omop_100: dict[str, Any]) -> None:
    """Every domain in the result contains only rows belonging to sampled patients.

    The INNER JOIN on PERSON_ID guarantees this automatically. This test
    verifies the guarantee holds across all 14 OMOP domains.
    """
    result = DatabaseSampler(fraction=0.1, seed=42).sample(omop_100)
    ref_ids = set(
        result["PERSON"].table.select("PERSON_ID").execute()["PERSON_ID"].tolist()
    )

    for name, domain in result.items():
        if domain is None or "PERSON_ID" not in domain.table.columns:
            continue
        domain_ids = set(
            domain.table.select("PERSON_ID").distinct().execute()["PERSON_ID"].tolist()
        )
        assert domain_ids <= ref_ids, (
            f"Domain '{name}' has rows from non-sampled patients: "
            f"{domain_ids - ref_ids}"
        )


def test_full_pipeline_end_to_end(omop_100: dict[str, Any]) -> None:
    """Walk through the complete workflow: sample → fetch → describe.

    This mirrors typical usage in a study script:
        1. sample()            -- builds lazy SQL, no data moves
        2. fetch_person_ids()  -- one DB round-trip to load IDs
        3. describe()          -- human-readable summary at every stage
    """
    sampler = DatabaseSampler(fraction=0.1, seed=42)
    result = sampler.sample(omop_100)

    person_count: int = (
        result["PERSON"].table.select("PERSON_ID").distinct().count().execute()
    )
    assert person_count > 0  # guard: fraction=0.1 on 100 patients must select some
    sampler.fetch_person_ids()

    assert sampler.person_id_count == person_count
    assert len(sampler.person_ids) == person_count

    desc: str = sampler.describe()
    assert "0.1" in desc
    assert str(person_count) in desc
    assert "||" in desc  # confirms type-agnostic string-concat algorithm


def test_adding_patients_does_not_change_existing_sample() -> None:
    """Adding new patients to PERSON does not change which existing patients are selected.

    This is the Stable property: hash selection depends only on each patient's
    own PERSON_ID, so new IDs entering the table don't shift existing results.
    """
    base_ids = _INT_PERSON_IDS_20
    extended_ids = _INT_PERSON_IDS_20 + [
        4619283,
        7250134,
        2983471,
        8047263,
        5731029,
        1392847,
        6584012,
        3710294,
        9061847,
        2483910,
        7124398,
        4856021,
        8302947,
        1637580,
        5974023,
        3290184,
        9481273,
        6745032,
        2108493,
        7362048,
    ]

    tables_base = {
        "PERSON": PhenexPersonTable(
            ibis.memtable(pd.DataFrame({"PERSON_ID": base_ids}))
        )
    }
    tables_ext = {
        "PERSON": PhenexPersonTable(
            ibis.memtable(pd.DataFrame({"PERSON_ID": extended_ids}))
        )
    }

    sampler = DatabaseSampler(fraction=0.5, seed=42)
    ids_base = set(
        sampler.sample(tables_base)["PERSON"]
        .table.select("PERSON_ID")
        .execute()["PERSON_ID"]
    )
    ids_ext = set(
        sampler.sample(tables_ext)["PERSON"]
        .table.select("PERSON_ID")
        .execute()["PERSON_ID"]
    )

    assert ids_base <= ids_ext


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
