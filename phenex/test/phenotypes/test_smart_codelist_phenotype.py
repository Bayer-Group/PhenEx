"""
Tests for SmartCodelistPhenotype.

Data layout (shared across all generators):
    CONDITION table  (CODE_TYPE = ICD10CM or ICD9CM)
        P1: c1 (ICD10CM), c2 (ICD9CM)
        P2: c1 (ICD10CM), c2 (ICD9CM)
        P3: c1 (ICD10CM)
        P4: c1 (ICD10CM)
        P5: c2 (ICD9CM)
        P6: c2 (ICD9CM)

    PROCEDURE table  (CODE_TYPE = CPT)
        P1: c3 (CPT)
        P3: c3 (CPT)
        P5: c3 (CPT)
        P7: c3 (CPT)

    PERSON table: P1–P8

Derived expectations:
    c1 (ICD10CM → CONDITION)      : P1, P2, P3, P4
    c2 (ICD9CM  → CONDITION)      : P1, P2, P5, P6
    c3 (CPT     → PROCEDURE)      : P1, P3, P5, P7
    c1 + c2 (same domain CONDITION): P1, P2, P3, P4, P5, P6
    c1 OR c3 (multi-domain)        : P1, P2, P3, P4, P5, P7
    c2 OR c3 (multi-domain)        : P1, P2, P3, P5, P6, P7
    c1+c2 OR c3 (multi-domain)     : P1, P2, P3, P4, P5, P6, P7
"""

import datetime
import os
import pytest
import pandas as pd

from phenex.phenotypes.smart_codelist_phenotype import SmartCodelistPhenotype, CODETYPE_INFO
from phenex.codelists.codelists import Codelist
from phenex.tables import CodeTable, PhenexPersonTable
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


# ---------------------------------------------------------------------------
# Shared input-table builder
# ---------------------------------------------------------------------------

def _build_input_tables():
    """Return input_info list for the standard CONDITION / PROCEDURE / PERSON layout."""
    # CONDITION rows
    condition_rows = [
        ("P1", "c1", "ICD10CM"),
        ("P1", "c2", "ICD9CM"),
        ("P2", "c1", "ICD10CM"),
        ("P2", "c2", "ICD9CM"),
        ("P3", "c1", "ICD10CM"),
        ("P4", "c1", "ICD10CM"),
        ("P5", "c2", "ICD9CM"),
        ("P6", "c2", "ICD9CM"),
    ]
    df_condition = pd.DataFrame(
        condition_rows, columns=["PERSON_ID", "CODE", "CODE_TYPE"]
    )
    df_condition["EVENT_DATE"] = datetime.date(2022, 1, 1)

    # PROCEDURE rows
    procedure_rows = [
        ("P1", "c3", "CPT"),
        ("P3", "c3", "CPT"),
        ("P5", "c3", "CPT"),
        ("P7", "c3", "CPT"),
    ]
    df_procedure = pd.DataFrame(
        procedure_rows, columns=["PERSON_ID", "CODE", "CODE_TYPE"]
    )
    df_procedure["EVENT_DATE"] = datetime.date(2022, 1, 1)

    # PERSON rows (P1–P8 so the LogicPhenotype OR properly includes non-matching persons)
    df_person = pd.DataFrame({"PERSON_ID": [f"P{i}" for i in range(1, 9)]})

    return [
        {"name": "CONDITION", "df": df_condition, "type": CodeTable},
        {"name": "PROCEDURE", "df": df_procedure, "type": CodeTable},
        {"name": "PERSON", "df": df_person},
    ]


# ---------------------------------------------------------------------------
# Test generator 1 – single domain (returns CodelistPhenotype)
# ---------------------------------------------------------------------------

class SmartCodelistPhenotypeSingleDomainTestGenerator(PhenotypeTestGenerator):
    """
    Tests where all code types in the codelist map to the same domain.
    SmartCodelistPhenotype must return a CodelistPhenotype (not a LogicPhenotype).
    """

    name_space = "smcl_single"

    def define_input_tables(self):
        return _build_input_tables()

    def define_phenotype_tests(self):
        # -- c1 via ICD-10-CM only (CONDITION) --
        c1_icd10 = {
            "name": "c1_icd10cm",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist({"ICD-10-CM": ["c1"]}, name="c1_icd10cm"),
            ),
        }

        # -- c2 via ICD-9-CM only (CONDITION) --
        c2_icd9 = {
            "name": "c2_icd9cm",
            "persons": ["P1", "P2", "P5", "P6"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist({"ICD-9-CM": ["c2"]}, name="c2_icd9cm"),
            ),
        }

        # -- c1 (ICD-10-CM) + c2 (ICD-9-CM): both map to CONDITION → single phenotype --
        c1_c2_same_domain = {
            "name": "c1c2_condition",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist(
                    {"ICD-10-CM": ["c1"], "ICD-9-CM": ["c2"]}, name="c1c2_condition"
                ),
            ),
        }

        # -- c3 via CPT only (PROCEDURE) --
        c3_cpt = {
            "name": "c3_cpt",
            "persons": ["P1", "P3", "P5", "P7"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist({"CPT": ["c3"]}, name="c3_cpt"),
            ),
        }

        # -- explicit name override --
        named = {
            "name": "explicit_name",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist({"ICD-10-CM": ["c1"]}, name="should_be_ignored"),
                name="explicit_name",
            ),
        }

        return [c1_icd10, c2_icd9, c1_c2_same_domain, c3_cpt, named]


# ---------------------------------------------------------------------------
# Test generator 2 – multi-domain (returns LogicPhenotype)
# ---------------------------------------------------------------------------

class SmartCodelistPhenotypeMultiDomainTestGenerator(PhenotypeTestGenerator):
    """
    Tests where code types span two domains.
    SmartCodelistPhenotype must return a LogicPhenotype (OR combination).
    """

    name_space = "smcl_multi"

    def define_input_tables(self):
        return _build_input_tables()

    def define_phenotype_tests(self):
        # c1 (CONDITION: P1,P2,P3,P4) OR c3 (PROCEDURE: P1,P3,P5,P7) = P1,P2,P3,P4,P5,P7
        c1_or_c3 = {
            "name": "c1_or_c3",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P7"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist(
                    {"ICD-10-CM": ["c1"], "CPT": ["c3"]}, name="c1_or_c3"
                ),
            ),
        }

        # c2 (CONDITION: P1,P2,P5,P6) OR c3 (PROCEDURE: P1,P3,P5,P7) = P1,P2,P3,P5,P6,P7
        c2_or_c3 = {
            "name": "c2_or_c3",
            "persons": ["P1", "P2", "P3", "P5", "P6", "P7"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist(
                    {"ICD-9-CM": ["c2"], "CPT": ["c3"]}, name="c2_or_c3"
                ),
            ),
        }

        # c1+c2 (CONDITION: P1-P6) OR c3 (PROCEDURE: P1,P3,P5,P7) = P1,P2,P3,P4,P5,P6,P7
        c1c2_or_c3 = {
            "name": "c1c2_or_c3",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6", "P7"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist(
                    {"ICD-10-CM": ["c1"], "ICD-9-CM": ["c2"], "CPT": ["c3"]},
                    name="c1c2_or_c3",
                ),
            ),
        }

        return [c1_or_c3, c2_or_c3, c1c2_or_c3]


# ---------------------------------------------------------------------------
# Test generator 3 – custom codetype_info
# ---------------------------------------------------------------------------

CUSTOM_CODETYPE_INFO = {
    "MY_ICD10": {
        "domain": "CONDITION",
        "source": "ICD10CM",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "MY_ICD9": {
        "domain": "CONDITION",
        "source": "ICD9CM",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "MY_CPT": {
        "domain": "PROCEDURE",
        "source": "CPT",
        "use_code_type": True,
        "remove_punctuation": False,
    },
}


class SmartCodelistPhenotypeCustomInfoTestGenerator(PhenotypeTestGenerator):
    """
    Tests passing a custom codetype_info dict with non-standard key names.
    The source values still map to real CODE_TYPE values in the test tables.
    """

    name_space = "smcl_custom_info"

    def define_input_tables(self):
        return _build_input_tables()

    def define_phenotype_tests(self):
        # Single domain via custom info
        c1_custom_single = {
            "name": "c1_custom_single",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist({"MY_ICD10": ["c1"]}, name="c1_custom_single"),
                codetype_info=CUSTOM_CODETYPE_INFO,
            ),
        }

        # Multi-domain via custom info
        c1_or_c3_custom = {
            "name": "c1_or_c3_custom",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P7"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist(
                    {"MY_ICD10": ["c1"], "MY_CPT": ["c3"]}, name="c1_or_c3_custom"
                ),
                codetype_info=CUSTOM_CODETYPE_INFO,
            ),
        }

        # Same-domain two custom code types
        c1_c2_custom = {
            "name": "c1c2_custom",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist(
                    {"MY_ICD10": ["c1"], "MY_ICD9": ["c2"]}, name="c1c2_custom"
                ),
                codetype_info=CUSTOM_CODETYPE_INFO,
            ),
        }

        return [c1_custom_single, c1_or_c3_custom, c1_c2_custom]


# ---------------------------------------------------------------------------
# Test generator 4 – filters propagate to sub-phenotypes
# ---------------------------------------------------------------------------

class SmartCodelistPhenotypeFiltersTestGenerator(PhenotypeTestGenerator):
    """
    Tests that date_range and relative_time_range filters are forwarded correctly
    to every component CodelistPhenotype, both in single- and multi-domain cases.
    """

    name_space = "smcl_filters"

    def define_input_tables(self):
        # Use two distinct event dates so we can filter by date
        condition_rows = [
            ("P1", "c1", "ICD10CM", datetime.date(2022, 6, 1)),
            ("P2", "c1", "ICD10CM", datetime.date(2021, 6, 1)),  # outside window
            ("P3", "c1", "ICD10CM", datetime.date(2022, 6, 1)),
            ("P4", "c1", "ICD10CM", datetime.date(2021, 6, 1)),  # outside window
            ("P1", "c2", "ICD9CM",  datetime.date(2022, 6, 1)),
            ("P5", "c2", "ICD9CM",  datetime.date(2021, 6, 1)),  # outside window
        ]
        df_condition = pd.DataFrame(
            condition_rows, columns=["PERSON_ID", "CODE", "CODE_TYPE", "EVENT_DATE"]
        )

        procedure_rows = [
            ("P1", "c3", "CPT", datetime.date(2022, 6, 1)),
            ("P3", "c3", "CPT", datetime.date(2021, 6, 1)),  # outside window
            ("P7", "c3", "CPT", datetime.date(2022, 6, 1)),
        ]
        df_procedure = pd.DataFrame(
            procedure_rows, columns=["PERSON_ID", "CODE", "CODE_TYPE", "EVENT_DATE"]
        )

        df_person = pd.DataFrame({"PERSON_ID": [f"P{i}" for i in range(1, 9)]})

        return [
            {"name": "CONDITION", "df": df_condition, "type": CodeTable},
            {"name": "PROCEDURE", "df": df_procedure, "type": CodeTable},
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        from phenex.filters.date_filter import DateFilter, After, Before

        date_range = DateFilter(
            min_date=After("2022-01-01"),
            max_date=Before("2022-12-31"),
        )

        # Single domain + date filter: only P1,P3 pass (P2,P4 are 2021)
        c1_date_filter = {
            "name": "c1_date_filtered",
            "persons": ["P1", "P3"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist({"ICD-10-CM": ["c1"]}, name="c1_date_filtered"),
                date_range=date_range,
            ),
        }

        # Single domain two code types + date filter: P1 (c1 2022), P3 (c1 2022), P1 (c2 2022)
        # → P1, P3
        c1c2_date_filter = {
            "name": "c1c2_date_filtered",
            "persons": ["P1", "P3"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist(
                    {"ICD-10-CM": ["c1"], "ICD-9-CM": ["c2"]}, name="c1c2_date_filtered"
                ),
                date_range=date_range,
            ),
        }

        # Multi-domain + date filter:
        # CONDITION: P1,P3 (c1 2022)
        # PROCEDURE: P1,P7 (c3 2022) — P3 is 2021 so excluded
        # OR → P1, P3, P7
        c1_or_c3_date_filter = {
            "name": "c1_or_c3_date_filtered",
            "persons": ["P1", "P3", "P7"],
            "phenotype": SmartCodelistPhenotype(
                codelist=Codelist(
                    {"ICD-10-CM": ["c1"], "CPT": ["c3"]},
                    name="c1_or_c3_date_filtered",
                ),
                date_range=date_range,
            ),
        }

        return [c1_date_filter, c1c2_date_filter, c1_or_c3_date_filter]


# ---------------------------------------------------------------------------
# Error-case tests (standalone, not via PhenotypeTestGenerator)
# ---------------------------------------------------------------------------

def test_smart_codelist_unknown_code_type_raises():
    """Unknown code types that are not in codetype_info must raise ValueError."""
    with pytest.raises(ValueError, match="not found in codetype_info"):
        SmartCodelistPhenotype(
            codelist=Codelist({"TOTALLY_UNKNOWN": ["x1"]}, name="bad"),
        )


def test_smart_codelist_none_code_type_raises():
    """Codelists without explicit code-type keys (keyed by None) must raise ValueError."""
    with pytest.raises(ValueError, match="None key"):
        SmartCodelistPhenotype(
            codelist=Codelist(["x1", "x2"], name="untyped"),
        )


def test_smart_codelist_returns_codelist_phenotype_type():
    """A single-domain codelist must produce an instance of CodelistPhenotype."""
    from phenex.phenotypes.codelist_phenotype import CodelistPhenotype

    p = SmartCodelistPhenotype(
        codelist=Codelist({"ICD-10-CM": ["I48.0"]}, name="af"),
    )
    assert isinstance(p, CodelistPhenotype)


def test_smart_codelist_returns_logic_phenotype_type():
    """A multi-domain codelist must produce an instance of LogicPhenotype."""
    from phenex.phenotypes.computation_graph_phenotypes import LogicPhenotype

    p = SmartCodelistPhenotype(
        codelist=Codelist({"ICD-10-CM": ["I48.0"], "CPT": ["93000"]}, name="af_or_ecg"),
    )
    assert isinstance(p, LogicPhenotype)


def test_smart_codelist_name_propagation():
    """Explicit name must be set on both single- and multi-domain results."""
    p_single = SmartCodelistPhenotype(
        codelist=Codelist({"ICD-10-CM": ["I48.0"]}, name="should_be_ignored"),
        name="my_name",
    )
    assert p_single.name == "MY_NAME"

    p_multi = SmartCodelistPhenotype(
        codelist=Codelist(
            {"ICD-10-CM": ["I48.0"], "CPT": ["93000"]}, name="should_be_ignored"
        ),
        name="my_multi_name",
    )
    assert p_multi.name == "MY_MULTI_NAME"


def test_smart_codelist_codelist_name_fallback():
    """When name is not supplied, the codelist name should be used."""
    p = SmartCodelistPhenotype(
        codelist=Codelist({"ICD-10-CM": ["I48.0"]}, name="af_codelist_name"),
    )
    assert p.name == "AF_CODELIST_NAME"


def test_smart_codelist_code_type_renamed_to_source():
    """
    The sub-codelist passed to each CodelistPhenotype must have keys renamed
    from the external code-type name to the 'source' value in CODETYPE_INFO.
    """
    p = SmartCodelistPhenotype(
        codelist=Codelist({"ICD-10-CM": ["I48.0", "I48.1"]}, name="af"),
    )
    # After SmartCodelistPhenotype, the internal codelist key should be "ICD10CM" not "ICD-10-CM"
    assert "ICD10CM" in p.codelist.codelist
    assert "ICD-10-CM" not in p.codelist.codelist


def test_smart_codelist_remove_punctuation_propagation():
    """Codelist.remove_punctuation must match the CODETYPE_INFO setting."""
    p = SmartCodelistPhenotype(
        codelist=Codelist({"ICD-10-CM": ["I48.0"]}, name="af"),
    )
    assert p.codelist.remove_punctuation == CODETYPE_INFO["ICD-10-CM"]["remove_punctuation"]


# ---------------------------------------------------------------------------
# Pytest entry points
# ---------------------------------------------------------------------------

def test_smart_codelist_single_domain():
    SmartCodelistPhenotypeSingleDomainTestGenerator().run_tests()


def test_smart_codelist_multi_domain():
    SmartCodelistPhenotypeMultiDomainTestGenerator().run_tests()


def test_smart_codelist_custom_info():
    SmartCodelistPhenotypeCustomInfoTestGenerator().run_tests()


def test_smart_codelist_filters():
    SmartCodelistPhenotypeFiltersTestGenerator().run_tests()


if __name__ == "__main__":
    test_smart_codelist_single_domain()
    test_smart_codelist_multi_domain()
    test_smart_codelist_custom_info()
    test_smart_codelist_filters()
    test_smart_codelist_unknown_code_type_raises()
    test_smart_codelist_none_code_type_raises()
    test_smart_codelist_returns_codelist_phenotype_type()
    test_smart_codelist_returns_logic_phenotype_type()
    test_smart_codelist_name_propagation()
    test_smart_codelist_codelist_name_fallback()
    test_smart_codelist_code_type_renamed_to_source()
    test_smart_codelist_remove_punctuation_propagation()
