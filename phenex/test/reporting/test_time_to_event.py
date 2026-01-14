"""
Unit tests for TimeToEvent reporter.

Note: Full end-to-end tests require actual Ibis backend integration.
These tests focus on initialization, inheritance, and basic structure.
"""

import pytest
import pandas as pd
from datetime import datetime
from unittest.mock import Mock, patch

from phenex.reporting.time_to_event import TimeToEvent


class TestTimeToEvent:
    """Test the TimeToEvent reporter."""

    def test_initialization(self):
        """Test that TimeToEvent initializes correctly."""
        death = Mock(name="Death")
        tte = TimeToEvent(
            right_censor_phenotypes=[death],
            end_of_study_period=datetime(2024, 12, 31),
            decimal_places=3,
            pretty_display=True,
        )

        assert tte.right_censor_phenotypes == [death]
        assert tte.end_of_study_period == datetime(2024, 12, 31)
        assert tte.decimal_places == 3
        assert tte.pretty_display is True
        assert tte._tte_table is None
        assert tte._date_column_names is None

    def test_initialization_defaults(self):
        """Test default parameter values."""
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        assert tte.decimal_places == 4
        assert tte.pretty_display is True

    def test_inherits_from_reporter(self):
        """Test that TimeToEvent properly inherits from Reporter."""
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # Should have Reporter methods
        assert hasattr(tte, "get_pretty_display")
        assert hasattr(tte, "to_excel")
        assert hasattr(tte, "to_csv")
        assert hasattr(tte, "execute")

    def test_fit_kaplan_meier_for_phenotype(self):
        """Test that fit_kaplan_meier_for_phenotype works with valid data."""
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # Create mock TTE table with required columns
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 0, 1, 0, 1],
                "DAYS_FIRST_EVENT_MI": [30, 60, 45, 90, 15],
            }
        )

        # Create mock phenotype
        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        # Fit KM
        kmf = tte.fit_kaplan_meier_for_phenotype(mock_phenotype)

        # Verify KMF has expected attributes
        assert hasattr(kmf, "survival_function_")
        assert hasattr(kmf, "event_table")
        assert kmf.label == "MI"

    def test_build_aggregated_risk_table(self):
        """Test that _build_aggregated_risk_table creates correct schema."""
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # Create mock TTE table
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 0, 1, 0, 1, 0],
                "DAYS_FIRST_EVENT_MI": [30, 60, 45, 90, 15, 120],
            }
        )

        # Create mock cohort with outcome
        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        # Build aggregated table
        result = tte._build_aggregated_risk_table()

        # Verify structure
        assert isinstance(result, pd.DataFrame)
        assert not result.empty

        # Check schema
        expected_columns = [
            "Outcome",
            "Timeline",
            "Survival_Probability",
            "At_Risk",
            "Events",
            "Censored",
        ]
        assert all(col in result.columns for col in expected_columns)

        # Check data types
        assert result["Outcome"].dtype == object  # string
        assert pd.api.types.is_numeric_dtype(result["Timeline"])
        assert pd.api.types.is_numeric_dtype(result["Survival_Probability"])
        assert pd.api.types.is_numeric_dtype(result["At_Risk"])

        # Check outcome name
        assert all(result["Outcome"] == "MI")

    def test_multiple_outcomes_in_aggregated_table(self):
        """Test that multiple outcomes are handled correctly in aggregated table."""
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # Create mock TTE table with two outcomes
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 0, 1],
                "DAYS_FIRST_EVENT_MI": [30, 60, 45],
                "INDICATOR_STROKE": [0, 1, 0],
                "DAYS_FIRST_EVENT_STROKE": [90, 30, 120],
            }
        )

        # Create mock phenotypes
        mock_mi = Mock()
        mock_mi.name = "MI"

        mock_stroke = Mock()
        mock_stroke.name = "Stroke"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_mi, mock_stroke]
        tte.cohort = mock_cohort

        # Build aggregated table
        result = tte._build_aggregated_risk_table()

        # Should have data for both outcomes
        assert "MI" in result["Outcome"].values
        assert "Stroke" in result["Outcome"].values

        # Each outcome should have multiple rows (time points)
        mi_rows = result[result["Outcome"] == "MI"]
        stroke_rows = result[result["Outcome"] == "Stroke"]
        assert len(mi_rows) > 0
        assert len(stroke_rows) > 0

    def test_survival_probability_bounds(self):
        """Test that survival probabilities are between 0 and 1."""
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # Create mock TTE table
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 1, 1, 0, 0],
                "DAYS_FIRST_EVENT_MI": [10, 20, 30, 40, 50],
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        result = tte._build_aggregated_risk_table()

        # All survival probabilities should be between 0 and 1
        assert all(result["Survival_Probability"] >= 0)
        assert all(result["Survival_Probability"] <= 1)

    def test_decimal_places_parameter(self):
        """Test that decimal_places parameter is set correctly."""
        tte1 = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
            decimal_places=2,
        )
        assert tte1.decimal_places == 2

        tte2 = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
            decimal_places=6,
        )
        assert tte2.decimal_places == 6

    def test_tte_table_initially_none(self):
        """Test that _tte_table starts as None and should be set by execute()."""
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        assert tte._tte_table is None
        # After execute(), _tte_table should be a DataFrame (tested in integration tests)

    def test_empty_outcomes_returns_empty_dataframe(self):
        """Test behavior when cohort has no outcomes."""
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # Mock empty cohort
        mock_cohort = Mock()
        mock_cohort.outcomes = []
        tte.cohort = mock_cohort
        tte._tte_table = pd.DataFrame()  # Empty TTE table

        result = tte._build_aggregated_risk_table()

        # Should return empty DataFrame
        assert isinstance(result, pd.DataFrame)
        assert result.empty
