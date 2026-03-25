"""
Tests for Cohort.get_codelists()
"""

import pytest
import pandas as pd
from phenex.core.cohort import Cohort
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.phenotypes.age_phenotype import AgePhenotype
from phenex.codelists import Codelist


AF_CODES = Codelist(
    {"ICD10": ["I48.0", "I48.1"], "ICD9": ["427.31"]},
    name="atrial_fibrillation",
)

MI_CODES = Codelist(
    {"ICD10": ["I21.0", "I21.1"]},
    name="myocardial_infarction",
)

ASPIRIN_CODES = Codelist(
    {"NDC": ["00000001"]},
    name="aspirin",
)


def _make_cohort(inclusions=None, exclusions=None, characteristics=None, outcomes=None):
    entry = CodelistPhenotype(
        name="entry_af",
        return_date="first",
        codelist=AF_CODES,
        domain="CONDITION_OCCURRENCE",
    )
    return Cohort(
        name="test_cohort",
        entry_criterion=entry,
        inclusions=inclusions or [],
        exclusions=exclusions or [],
        characteristics=characteristics or [],
        outcomes=outcomes or [],
    )


class TestGetCodelistsDict:
    def test_returns_dict_by_default(self):
        cohort = _make_cohort()
        result = cohort.get_codelists()
        assert isinstance(result, dict)

    def test_entry_codelist_present(self):
        cohort = _make_cohort()
        result = cohort.get_codelists()
        assert len(result) == 1
        codelist = next(iter(result.values()))
        assert codelist.codelist == AF_CODES.codelist

    def test_inclusion_codelist_present(self):
        mi_pt = CodelistPhenotype(
            name="mi_inclusion",
            return_date="first",
            codelist=MI_CODES,
            domain="CONDITION_OCCURRENCE",
        )
        cohort = _make_cohort(inclusions=[mi_pt])
        result = cohort.get_codelists()
        assert len(result) == 2

    def test_phenotype_without_codelist_excluded(self):
        age_pt = AgePhenotype(name="age_characteristic")
        cohort = _make_cohort(characteristics=[age_pt])
        result = cohort.get_codelists()
        # Only entry_af has a codelist; age has none
        assert len(result) == 1

    def test_all_roles_included(self):
        mi_pt = CodelistPhenotype(
            name="mi_inclusion",
            return_date="first",
            codelist=MI_CODES,
            domain="CONDITION_OCCURRENCE",
        )
        aspirin_pt = CodelistPhenotype(
            name="aspirin_exclusion",
            return_date="first",
            codelist=ASPIRIN_CODES,
            domain="DRUG_EXPOSURE",
        )
        cohort = _make_cohort(inclusions=[mi_pt], exclusions=[aspirin_pt])
        result = cohort.get_codelists()
        assert len(result) == 3


class TestGetCodelistsDataFrame:
    def test_returns_dataframe(self):
        cohort = _make_cohort()
        df = cohort.get_codelists(as_dataframe=True)
        assert isinstance(df, pd.DataFrame)

    def test_expected_columns(self):
        cohort = _make_cohort()
        df = cohort.get_codelists(as_dataframe=True)
        assert set(df.columns) == {"code", "codelist", "code_type", "phenotype"}

    def test_codes_present(self):
        cohort = _make_cohort()
        df = cohort.get_codelists(as_dataframe=True)
        assert set(df["code"]) == {"I48.0", "I48.1", "427.31"}

    def test_code_types_present(self):
        cohort = _make_cohort()
        df = cohort.get_codelists(as_dataframe=True)
        assert set(df["code_type"]) == {"ICD10", "ICD9"}

    def test_codelist_name_column(self):
        cohort = _make_cohort()
        df = cohort.get_codelists(as_dataframe=True)
        assert set(df["codelist"]) == {"atrial_fibrillation"}

    def test_phenotype_column_contains_display_name(self):
        cohort = _make_cohort()
        df = cohort.get_codelists(as_dataframe=True)
        # phenotype column should be the display name of the phenotype, not the codelist name
        assert df["phenotype"].notna().all()
        assert len(df["phenotype"].unique()) == 1

    def test_multiple_phenotypes_row_count(self):
        mi_pt = CodelistPhenotype(
            name="mi_inclusion",
            return_date="first",
            codelist=MI_CODES,
            domain="CONDITION_OCCURRENCE",
        )
        cohort = _make_cohort(inclusions=[mi_pt])
        df = cohort.get_codelists(as_dataframe=True)
        # AF: 3 codes, MI: 2 codes
        assert len(df) == 5

    def test_multiple_phenotypes_phenotype_column(self):
        mi_pt = CodelistPhenotype(
            name="mi_inclusion",
            return_date="first",
            codelist=MI_CODES,
            domain="CONDITION_OCCURRENCE",
        )
        cohort = _make_cohort(inclusions=[mi_pt])
        df = cohort.get_codelists(as_dataframe=True)
        assert len(df["phenotype"].unique()) == 2

    def test_multiple_phenotypes_codelist_names(self):
        mi_pt = CodelistPhenotype(
            name="mi_inclusion",
            return_date="first",
            codelist=MI_CODES,
            domain="CONDITION_OCCURRENCE",
        )
        cohort = _make_cohort(inclusions=[mi_pt])
        df = cohort.get_codelists(as_dataframe=True)
        assert set(df["codelist"]) == {"atrial_fibrillation", "myocardial_infarction"}

    def test_no_duplicate_codes_across_phenotypes(self):
        mi_pt = CodelistPhenotype(
            name="mi_inclusion",
            return_date="first",
            codelist=MI_CODES,
            domain="CONDITION_OCCURRENCE",
        )
        cohort = _make_cohort(inclusions=[mi_pt])
        df = cohort.get_codelists(as_dataframe=True)
        # Each (code, code_type, phenotype) combination is unique
        assert not df.duplicated(subset=["code", "code_type", "phenotype"]).any()
