"""
Tests for LiverDysfunctionPhenotype.

The phenotype flags patients with elevated ALT or AST using sex-split value
thresholds (ALT | AST). Because the underlying SexSplitMeasurementPhenotype
applies *both* the male and female value filters to all patients (the
categorical sex filters are stored in the components but not yet forwarded),
a patient is included when their value exceeds *either* threshold.

Thresholds used in tests
    ALT male:   > 56      (upper limit of normal for males)
    ALT female: > 45      (upper limit of normal for females)
    AST male:   > 40
    AST female: > 32

Since female thresholds are lower, the effective inclusion criterion is:
    ALT > 45  OR  AST > 32

Data layout (LAB table, domain = "LAB"):
    P1: ALT=60               → included  (ALT > 45 and > 56)
    P2: ALT=50               → included  (ALT > 45 only)
    P3: ALT=30, AST=50       → included  (AST > 40 and > 32)
    P4: ALT=30, AST=35       → included  (AST > 32 only)
    P5: ALT=46, AST=33       → included  (both ALT female and AST female)
    P6: ALT=40, AST=25       → excluded  (neither threshold met)
    P7: no measurements      → excluded
    P8: ALT=null             → excluded  (null cleaned before filtering)
    P9: ALT=45, AST=32       → excluded  (exactly at boundary, not strictly >)

PERSON table: P1–P9
"""

import datetime
import pandas as pd

from phenex.codelists.codelists import Codelist
from phenex.filters.value_filter import ValueFilter
from phenex.filters.value import GreaterThan, LessThan, GreaterThanOrEqualTo
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.phenotypes.factory.liver_dysfunction_phenotype import (
    LiverDysfunctionPhenotype,
    LiverDysfunctionComponents,
)
from phenex.tables import MeasurementTable, PhenexPersonTable
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

ALT_CODE = "ALT"
AST_CODE = "AST"
EVENT_DATE = datetime.date(2022, 6, 1)

ALT_MALE_FILTER = ValueFilter(min_value=GreaterThan(56))
ALT_FEMALE_FILTER = ValueFilter(min_value=GreaterThan(45))
AST_MALE_FILTER = ValueFilter(min_value=GreaterThan(40))
AST_FEMALE_FILTER = ValueFilter(min_value=GreaterThan(32))


def _make_components():
    return LiverDysfunctionComponents(
        alt_codelist=Codelist({ALT_CODE: [ALT_CODE]}, name="alt"),
        ast_codelist=Codelist({AST_CODE: [AST_CODE]}, name="ast"),
        categorical_filter_male=CategoricalFilter(
            column_name="SEX", allowed_values=["M"], domain="PERSON"
        ),
        categorical_filter_female=CategoricalFilter(
            column_name="SEX", allowed_values=["F"], domain="PERSON"
        ),
        alt_value_filter_male=ALT_MALE_FILTER,
        alt_value_filter_female=ALT_FEMALE_FILTER,
        ast_value_filter_male=AST_MALE_FILTER,
        ast_value_filter_female=AST_FEMALE_FILTER,
        domain="LAB",
    )


def _build_lab_df(extra_rows=None):
    rows = [
        # (PERSON_ID, CODE,     CODE_TYPE, VALUE, EVENT_DATE)
        ("P1", ALT_CODE, ALT_CODE, 60.0,  EVENT_DATE),  # ALT > 56 and > 45
        ("P2", ALT_CODE, ALT_CODE, 50.0,  EVENT_DATE),  # ALT > 45 only
        ("P3", ALT_CODE, ALT_CODE, 30.0,  EVENT_DATE),  # ALT not elevated
        ("P3", AST_CODE, AST_CODE, 50.0,  EVENT_DATE),  # AST > 40 and > 32
        ("P4", ALT_CODE, ALT_CODE, 30.0,  EVENT_DATE),  # ALT not elevated
        ("P4", AST_CODE, AST_CODE, 35.0,  EVENT_DATE),  # AST > 32 only
        ("P5", ALT_CODE, ALT_CODE, 46.0,  EVENT_DATE),  # ALT > 45 (female)
        ("P5", AST_CODE, AST_CODE, 33.0,  EVENT_DATE),  # AST > 32 (female)
        ("P6", ALT_CODE, ALT_CODE, 40.0,  EVENT_DATE),  # ALT not elevated
        ("P6", AST_CODE, AST_CODE, 25.0,  EVENT_DATE),  # AST not elevated
        # P7: no rows → excluded
        ("P8", ALT_CODE, ALT_CODE, None,  EVENT_DATE),  # null value
        ("P9", ALT_CODE, ALT_CODE, 45.0,  EVENT_DATE),  # boundary (not > 45)
        ("P9", AST_CODE, AST_CODE, 32.0,  EVENT_DATE),  # boundary (not > 32)
    ]
    df = pd.DataFrame(rows, columns=["PERSON_ID", "CODE", "CODE_TYPE", "VALUE", "EVENT_DATE"])
    if extra_rows:
        df = pd.concat([df, pd.DataFrame(extra_rows, columns=df.columns)], ignore_index=True)
    return df


def _build_person_df(ids=None):
    if ids is None:
        ids = [f"P{i}" for i in range(1, 10)]
    sex_map = {f"P{i}": ("M" if i % 2 == 1 else "F") for i in range(1, 10)}
    return pd.DataFrame({"PERSON_ID": ids, "SEX": [sex_map.get(p, "M") for p in ids]})


# ---------------------------------------------------------------------------
# Test generator 1 – basic thresholds and all patient edge cases
# ---------------------------------------------------------------------------


class LiverDysfunctionBasicTestGenerator(PhenotypeTestGenerator):
    """
    Covers: only ALT elevated, only AST elevated, both elevated, neither,
    boundary values, null value, and missing patient.
    """

    name_space = "ldp_basic"

    def define_input_tables(self):
        return [
            {"name": "LAB", "df": _build_lab_df(), "type": MeasurementTable},
            {"name": "PERSON", "df": _build_person_df(), "type": PhenexPersonTable},
        ]

    def define_phenotype_tests(self):
        basic = {
            "name": "liver_dysfunction",
            "persons": ["P1", "P2", "P3", "P4", "P5"],
            "phenotype": LiverDysfunctionPhenotype(
                components=_make_components(),
                name="liver_dysfunction",
            ),
        }
        return [basic]


# ---------------------------------------------------------------------------
# Test generator 2 – name override
# ---------------------------------------------------------------------------


class LiverDysfunctionNameTestGenerator(PhenotypeTestGenerator):
    """Verifies that the name parameter is forwarded to the returned phenotype."""

    name_space = "ldp_name"

    def define_input_tables(self):
        return [
            {"name": "LAB", "df": _build_lab_df(), "type": MeasurementTable},
            {"name": "PERSON", "df": _build_person_df(), "type": PhenexPersonTable},
        ]

    def define_phenotype_tests(self):
        custom_name = {
            "name": "my_liver",
            "persons": ["P1", "P2", "P3", "P4", "P5"],
            "phenotype": LiverDysfunctionPhenotype(
                components=_make_components(),
                name="my_liver",
            ),
        }
        return [custom_name]


# ---------------------------------------------------------------------------
# Test generator 3 – relative_time_range
# ---------------------------------------------------------------------------


class LiverDysfunctionRelativeTimeRangeTestGenerator(PhenotypeTestGenerator):
    """
    Tests that relative_time_range is forwarded to both ALT and AST sub-phenotypes.

    Index date = 2022-01-01 for all patients.
    Pre-index (2021): P1 ALT=60, P3 AST=50.
    Post-index (2023): P2 ALT=50, P4 AST=35.

    After-index filter → P2, P4.
    Before-index filter → P1, P3.
    """

    name_space = "ldp_timerange"
    INDEX_DATE = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        rows = [
            ("P1", ALT_CODE, ALT_CODE, 60.0, datetime.date(2021, 6, 1), self.INDEX_DATE),
            ("P2", ALT_CODE, ALT_CODE, 50.0, datetime.date(2023, 6, 1), self.INDEX_DATE),
            ("P3", AST_CODE, AST_CODE, 50.0, datetime.date(2021, 6, 1), self.INDEX_DATE),
            ("P4", AST_CODE, AST_CODE, 35.0, datetime.date(2023, 6, 1), self.INDEX_DATE),
        ]
        df = pd.DataFrame(
            rows, columns=["PERSON_ID", "CODE", "CODE_TYPE", "VALUE", "EVENT_DATE", "INDEX_DATE"]
        )
        person_df = pd.DataFrame({
            "PERSON_ID": ["P1", "P2", "P3", "P4"],
            "SEX": ["M", "F", "M", "F"],
            "INDEX_DATE": [self.INDEX_DATE] * 4,
        })
        return [
            {"name": "LAB", "df": df, "type": MeasurementTable},
            {"name": "PERSON", "df": person_df, "type": PhenexPersonTable},
        ]

    def define_phenotype_tests(self):
        components = _make_components()

        after_index = {
            "name": "ldp_after_index",
            "persons": ["P2", "P4"],
            "phenotype": LiverDysfunctionPhenotype(
                components=components,
                name="ldp_after_index",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
            ),
        }

        before_index = {
            "name": "ldp_before_index",
            "persons": ["P1", "P3"],
            "phenotype": LiverDysfunctionPhenotype(
                components=components,
                name="ldp_before_index",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
            ),
        }

        return [after_index, before_index]


# ---------------------------------------------------------------------------
# Test generator 4 – clean_nonphysiologicals_value_filter
# ---------------------------------------------------------------------------


class LiverDysfunctionCleanPhysioTestGenerator(PhenotypeTestGenerator):
    """
    Tests that clean_nonphysiologicals_value_filter is forwarded to both ALT and
    AST sub-phenotypes.

    P10: ALT=999 (physiologically impossible). Without cleaning → included (>45).
    P11: AST=999 (physiologically impossible). Without cleaning → included (>32).
    With clean_nonphysiologicals_value_filter=ValueFilter(max_value=LessThan(500))
    → P10 and P11 are removed before value filtering → excluded.
    """

    name_space = "ldp_cleanphysio"

    def define_input_tables(self):
        extra = [
            ("P10", ALT_CODE, ALT_CODE, 999.0, EVENT_DATE),
            ("P11", AST_CODE, AST_CODE, 999.0, EVENT_DATE),
        ]
        df = _build_lab_df(extra_rows=extra)
        ids = [f"P{i}" for i in range(1, 10)] + ["P10", "P11"]
        return [
            {"name": "LAB", "df": df, "type": MeasurementTable},
            {"name": "PERSON", "df": _build_person_df(ids), "type": PhenexPersonTable},
        ]

    def define_phenotype_tests(self):
        components = _make_components()

        without_cleaning = {
            "name": "ldp_no_cleaning",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P10", "P11"],
            "phenotype": LiverDysfunctionPhenotype(
                components=components,
                name="ldp_no_cleaning",
                clean_nonphysiologicals_value_filter=None,
            ),
        }

        with_cleaning = {
            "name": "ldp_with_cleaning",
            "persons": ["P1", "P2", "P3", "P4", "P5"],
            "phenotype": LiverDysfunctionPhenotype(
                components=components,
                name="ldp_with_cleaning",
                clean_nonphysiologicals_value_filter=ValueFilter(
                    max_value=LessThan(500)
                ),
            ),
        }

        return [without_cleaning, with_cleaning]


# ---------------------------------------------------------------------------
# Test generator 5 – clean_null_values=False
# ---------------------------------------------------------------------------


class LiverDysfunctionNullValuesTestGenerator(PhenotypeTestGenerator):
    """
    Tests clean_null_values=False: null measurements are retained and participate
    in value filtering (null does not satisfy GreaterThan, so P8 still excluded).
    The key assertion is that no error is raised and non-null elevated patients
    are still correctly included.
    """

    name_space = "ldp_nullvalues"

    def define_input_tables(self):
        return [
            {"name": "LAB", "df": _build_lab_df(), "type": MeasurementTable},
            {"name": "PERSON", "df": _build_person_df(), "type": PhenexPersonTable},
        ]

    def define_phenotype_tests(self):
        no_null_cleaning = {
            "name": "ldp_keep_nulls",
            "persons": ["P1", "P2", "P3", "P4", "P5"],
            "phenotype": LiverDysfunctionPhenotype(
                components=_make_components(),
                name="ldp_keep_nulls",
                clean_null_values=False,
            ),
        }
        return [no_null_cleaning]


# ---------------------------------------------------------------------------
# Structural unit tests (no data execution)
# ---------------------------------------------------------------------------


def test_returns_logic_phenotype():
    """LiverDysfunctionPhenotype must return a LogicPhenotype (ALT | AST)."""
    from phenex.phenotypes.computation_graph_phenotypes import LogicPhenotype

    result = LiverDysfunctionPhenotype(components=_make_components())
    assert isinstance(result, LogicPhenotype)


def test_default_name():
    """Default name must be 'LIVER_DYSFUNCTION'."""
    result = LiverDysfunctionPhenotype(components=_make_components())
    assert result.name == "LIVER_DYSFUNCTION"


def test_custom_name():
    """Custom name must be uppercased and applied to the result."""
    result = LiverDysfunctionPhenotype(components=_make_components(), name="my_ld")
    assert result.name == "MY_LD"


def test_sub_phenotype_names():
    """Sub-phenotypes must be named <name>_ALT and <name>_AST."""
    result = LiverDysfunctionPhenotype(components=_make_components(), name="ld")
    sub_names = {pt.name for pt in result.children}
    assert "LD_ALT" in sub_names
    assert "LD_AST" in sub_names


# ---------------------------------------------------------------------------
# Pytest entry points
# ---------------------------------------------------------------------------


def test_liver_dysfunction_basic():
    LiverDysfunctionBasicTestGenerator().run_tests()


def test_liver_dysfunction_name():
    LiverDysfunctionNameTestGenerator().run_tests()


def test_liver_dysfunction_relative_time_range():
    LiverDysfunctionRelativeTimeRangeTestGenerator().run_tests()


def test_liver_dysfunction_clean_physio():
    LiverDysfunctionCleanPhysioTestGenerator().run_tests()


def test_liver_dysfunction_null_values():
    LiverDysfunctionNullValuesTestGenerator().run_tests()


if __name__ == "__main__":
    test_liver_dysfunction_basic()
    test_liver_dysfunction_name()
    test_liver_dysfunction_relative_time_range()
    test_liver_dysfunction_clean_physio()
    test_liver_dysfunction_null_values()
    test_returns_logic_phenotype()
    test_default_name()
    test_custom_name()
    test_sub_phenotype_names()
