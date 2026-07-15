"""
Tests for SexSplitMeasurementPhenotype.

The phenotype applies separate value thresholds for males and females, then ORs the
results. Note: in the current implementation the categorical_filter_male/female stored
in SexSplitMeasurementComponents are not forwarded to the underlying
MeasurementPhenotypes, so sex is not actually filtered — any patient whose value meets
EITHER threshold is included.

Data layout:
    LAB table (CODE_TYPE = LAB_CODE):
        P1: value=15  → included  (male filter: >10 ✓)
        P2: value=3   → included  (female filter: <5 ✓)
        P3: value=7   → excluded  (neither >10 nor <5)
        P4: value=null → excluded (null, cleaned by clean_null_values)
        P5: value=10  → excluded  (boundary: not strictly >10)
        P6: value=5   → excluded  (boundary: not strictly <5)
        P7: (no record) → excluded
        P8: value=12, code=OTHER_CODE → excluded (wrong code)

    Male value filter:   GreaterThan(10)
    Female value filter: LessThan(5)
"""

import datetime
import pandas as pd
import pytest

from phenex.codelists.codelists import Codelist
from phenex.filters.value_filter import ValueFilter
from phenex.filters.value import GreaterThan, LessThan, GreaterThanOrEqualTo
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.phenotypes.factory.sex_split_measurement_phenotype import (
    SexSplitMeasurementPhenotype,
    SexSplitMeasurementComponents,
)
from phenex.tables import MeasurementTable, PhenexPersonTable
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

LAB_CODE = "LAB001"
OTHER_CODE = "OTHER"
SEX_COL = "SEX"

MALE_VALUE_FILTER = ValueFilter(min_value=GreaterThan(10))
FEMALE_VALUE_FILTER = ValueFilter(max_value=LessThan(5))


def _make_components(codelist=None):
    if codelist is None:
        codelist = Codelist({LAB_CODE: [LAB_CODE]}, name="lab_measure")
    return SexSplitMeasurementComponents(
        codelist=codelist,
        categorical_filter_male=CategoricalFilter(
            column_name=SEX_COL, allowed_values=["M"], domain="PERSON"
        ),
        categorical_filter_female=CategoricalFilter(
            column_name=SEX_COL, allowed_values=["F"], domain="PERSON"
        ),
        value_filter_male=MALE_VALUE_FILTER,
        value_filter_female=FEMALE_VALUE_FILTER,
        domain="LAB",
    )


def _build_base_lab_df():
    rows = [
        # (PERSON_ID, CODE,       CODE_TYPE, VALUE,  EVENT_DATE)
        ("P1", LAB_CODE, LAB_CODE, 15.0, datetime.date(2022, 6, 1)),  # male filter
        ("P2", LAB_CODE, LAB_CODE, 3.0, datetime.date(2022, 6, 1)),  # female filter
        ("P3", LAB_CODE, LAB_CODE, 7.0, datetime.date(2022, 6, 1)),  # neither
        ("P4", LAB_CODE, LAB_CODE, None, datetime.date(2022, 6, 1)),  # null value
        ("P5", LAB_CODE, LAB_CODE, 10.0, datetime.date(2022, 6, 1)),  # boundary male
        ("P6", LAB_CODE, LAB_CODE, 5.0, datetime.date(2022, 6, 1)),  # boundary female
        # P7 has no row → excluded
        ("P8", OTHER_CODE, OTHER_CODE, 12.0, datetime.date(2022, 6, 1)),  # wrong code
    ]
    df = pd.DataFrame(
        rows, columns=["PERSON_ID", "CODE", "CODE_TYPE", "VALUE", "EVENT_DATE"]
    )
    return df


def _build_person_df(ids=None):
    if ids is None:
        ids = [f"P{i}" for i in range(1, 9)]
    sex_map = {
        "P1": "M",
        "P2": "F",
        "P3": "M",
        "P4": "F",
        "P5": "M",
        "P6": "F",
        "P7": "M",
        "P8": "F",
    }
    return pd.DataFrame({"PERSON_ID": ids, "SEX": [sex_map.get(p, "M") for p in ids]})


# ---------------------------------------------------------------------------
# Test generator 1 – basic value thresholds
# ---------------------------------------------------------------------------


class SexSplitMeasurementBasicTestGenerator(PhenotypeTestGenerator):
    """
    Core tests: value meeting male threshold, female threshold, neither, boundary, null,
    missing record, and wrong code.
    """

    name_space = "ssmp_basic"

    def define_input_tables(self):
        return [
            {"name": "LAB", "df": _build_base_lab_df(), "type": MeasurementTable},
            {"name": "PERSON", "df": _build_person_df(), "type": PhenexPersonTable},
        ]

    def define_phenotype_tests(self):
        components = _make_components()

        basic = {
            "name": "sex_split_basic",
            "persons": ["P1", "P2"],
            "phenotype": SexSplitMeasurementPhenotype(
                name="sex_split_basic",
                components=components,
            ),
        }

        return [basic]


# ---------------------------------------------------------------------------
# Test generator 2 – clean_nonphysiologicals_value_filter
# ---------------------------------------------------------------------------


class SexSplitMeasurementCleanPhysioTestGenerator(PhenotypeTestGenerator):
    """
    Tests that clean_nonphysiologicals_value_filter removes impossible values before
    the primary value filter is applied.

    Extra patient P_phys: value=999 (physiologically impossible, >100).
    Without cleaning → would be included by male filter (>10).
    With cleaning (remove >100) → excluded.
    """

    name_space = "ssmp_cleanphysio"

    def define_input_tables(self):
        df = _build_base_lab_df()
        extra = pd.DataFrame(
            [
                {
                    "PERSON_ID": "P9",
                    "CODE": LAB_CODE,
                    "CODE_TYPE": LAB_CODE,
                    "VALUE": 999.0,
                    "EVENT_DATE": datetime.date(2022, 6, 1),
                }
            ]
        )
        df_all = pd.concat([df, extra], ignore_index=True)

        ids = [f"P{i}" for i in range(1, 9)] + ["P9"]
        person_df = _build_person_df(ids)

        return [
            {"name": "LAB", "df": df_all, "type": MeasurementTable},
            {"name": "PERSON", "df": person_df, "type": PhenexPersonTable},
        ]

    def define_phenotype_tests(self):
        components = _make_components()

        # Without cleaning: P1 (15), P2 (3), P9 (999) all pass
        without_cleaning = {
            "name": "ssmp_no_cleaning",
            "persons": ["P1", "P2", "P9"],
            "phenotype": SexSplitMeasurementPhenotype(
                name="ssmp_no_cleaning",
                components=components,
                clean_nonphysiologicals_value_filter=None,
            ),
        }

        # With cleaning (remove values > 100): P9 is filtered out before value check
        with_cleaning = {
            "name": "ssmp_with_cleaning",
            "persons": ["P1", "P2"],
            "phenotype": SexSplitMeasurementPhenotype(
                name="ssmp_with_cleaning",
                components=components,
                clean_nonphysiologicals_value_filter=ValueFilter(
                    max_value=LessThan(100)
                ),
            ),
        }

        return [without_cleaning, with_cleaning]


# ---------------------------------------------------------------------------
# Test generator 3 – relative_time_range
# ---------------------------------------------------------------------------


class SexSplitMeasurementRelativeTimeRangeTestGenerator(PhenotypeTestGenerator):
    """
    Tests that relative_time_range is forwarded to both male and female sub-phenotypes.

    Index date = 2022-01-01 for all patients.
    Pre-index measurements (2021): P1 (value=15), P2 (value=3).
    Post-index measurements (2022): P1 (value=15), P3 (value=7 — excluded by value filter).

    With when="after" filter: only post-index records count → P1 only.
    With when="before" filter: only pre-index records count → P1, P2.
    """

    name_space = "ssmp_timerange"

    INDEX_DATE = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        rows = [
            # pre-index
            (
                "P1",
                LAB_CODE,
                LAB_CODE,
                15.0,
                datetime.date(2021, 6, 1),
                self.INDEX_DATE,
            ),
            ("P2", LAB_CODE, LAB_CODE, 3.0, datetime.date(2021, 6, 1), self.INDEX_DATE),
            # post-index
            (
                "P1",
                LAB_CODE,
                LAB_CODE,
                15.0,
                datetime.date(2023, 6, 1),
                self.INDEX_DATE,
            ),
            ("P3", LAB_CODE, LAB_CODE, 7.0, datetime.date(2023, 6, 1), self.INDEX_DATE),
        ]
        df = pd.DataFrame(
            rows,
            columns=[
                "PERSON_ID",
                "CODE",
                "CODE_TYPE",
                "VALUE",
                "EVENT_DATE",
                "INDEX_DATE",
            ],
        )

        ids = ["P1", "P2", "P3"]
        person_df = pd.DataFrame(
            {
                "PERSON_ID": ids,
                "SEX": ["M", "F", "M"],
                "INDEX_DATE": [self.INDEX_DATE] * 3,
            }
        )

        return [
            {"name": "LAB", "df": df, "type": MeasurementTable},
            {"name": "PERSON", "df": person_df, "type": PhenexPersonTable},
        ]

    def define_phenotype_tests(self):
        components = _make_components()

        after_index = {
            "name": "ssmp_after_index",
            "persons": ["P1"],
            "phenotype": SexSplitMeasurementPhenotype(
                name="ssmp_after_index",
                components=components,
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="after"
                ),
            ),
        }

        before_index = {
            "name": "ssmp_before_index",
            "persons": ["P1", "P2"],
            "phenotype": SexSplitMeasurementPhenotype(
                name="ssmp_before_index",
                components=components,
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(0), when="before"
                ),
            ),
        }

        return [after_index, before_index]


# ---------------------------------------------------------------------------
# Structural unit tests (no data execution)
# ---------------------------------------------------------------------------


def test_returns_logic_phenotype():
    """SexSplitMeasurementPhenotype must return a LogicPhenotype (OR combination)."""
    from phenex.phenotypes.computation_graph_phenotypes import LogicPhenotype

    result = SexSplitMeasurementPhenotype(
        name="test_logic",
        components=_make_components(),
    )
    assert isinstance(result, LogicPhenotype)


def test_name_propagated():
    """The name argument must be set on the returned phenotype."""
    result = SexSplitMeasurementPhenotype(
        name="my_phenotype",
        components=_make_components(),
    )
    assert result.name == "MY_PHENOTYPE"


def test_sub_phenotype_names():
    """Sub-phenotypes must be named <name>_male and <name>_female."""
    from phenex.phenotypes.computation_graph_phenotypes import LogicPhenotype

    result = SexSplitMeasurementPhenotype(
        name="creatinine",
        components=_make_components(),
    )
    assert isinstance(result, LogicPhenotype)
    sub_names = {pt.name for pt in result.children}
    assert "CREATININE_MALE" in sub_names
    assert "CREATININE_FEMALE" in sub_names


# ---------------------------------------------------------------------------
# Pytest entry points
# ---------------------------------------------------------------------------


def test_sex_split_measurement_basic():
    SexSplitMeasurementBasicTestGenerator().run_tests()


def test_sex_split_measurement_clean_physio():
    SexSplitMeasurementCleanPhysioTestGenerator().run_tests()


def test_sex_split_measurement_relative_time_range():
    SexSplitMeasurementRelativeTimeRangeTestGenerator().run_tests()


if __name__ == "__main__":
    test_sex_split_measurement_basic()
    test_sex_split_measurement_clean_physio()
    test_sex_split_measurement_relative_time_range()
    test_returns_logic_phenotype()
    test_name_propagated()
    test_sub_phenotype_names()
