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

    def test_km_calculation_simple_case_no_censoring(self):
        """
        Test Kaplan-Meier calculation correctness with a simple case (no censoring).

        Hand-calculated example:
        - 5 patients total (5 rows in _tte_table)
        - Events at days: 10, 20, 30
        - 2 patients censored at day 100 (no MI)

        Expected survival probabilities:
        - At day 0: 1.0 (5/5 survived)
        - At day 10: 0.8 (4/5 survived)
        - At day 20: 0.6 (3/5 survived)
        - At day 30: 0.4 (2/5 survived)
        """
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # 5 patients (rows): 3 with MI events, 2 censored
        # Each row = one patient
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 1, 1, 0, 0],  # First 3 had MI, last 2 censored
                "DAYS_FIRST_EVENT_MI": [
                    10,
                    20,
                    30,
                    100,
                    100,
                ],  # Days to event/censoring
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        result = tte._build_aggregated_risk_table()

        # Verify we have rows for the event times
        event_times = result[result["Events"] > 0]["Timeline"].values
        assert 10.0 in event_times
        assert 20.0 in event_times
        assert 30.0 in event_times

        # Check survival probabilities at event times
        # At day 10: S = 4/5 = 0.8
        surv_at_10 = result[result["Timeline"] == 10.0]["Survival_Probability"].iloc[0]
        assert abs(surv_at_10 - 0.8) < 0.001

        # At day 20: S = 3/5 = 0.6
        surv_at_20 = result[result["Timeline"] == 20.0]["Survival_Probability"].iloc[0]
        assert abs(surv_at_20 - 0.6) < 0.001

        # At day 30: S = 2/5 = 0.4
        surv_at_30 = result[result["Timeline"] == 30.0]["Survival_Probability"].iloc[0]
        assert abs(surv_at_30 - 0.4) < 0.001

    def test_km_calculation_with_censoring(self):
        """
        Test Kaplan-Meier calculation with censoring.

        Hand-calculated example:
        - 4 patients (4 rows in _tte_table)
        - Event at day 10 (patient 1)
        - Censoring at day 15 (patient 2)
        - Event at day 20 (patient 3)
        - Censoring at day 30 (patient 4)

        Expected:
        - At day 10: at_risk=4, events=1, S = 3/4 = 0.75
        - At day 15: at_risk=3, censored=1, S = 0.75 (no event)
        - At day 20: at_risk=2, events=1, S = 0.75 * (1/2) = 0.375
        - At day 30: at_risk=1, censored=1, S = 0.375 (no event)
        """
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # 4 patients: alternating events and censoring
        # Each row = one patient
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 0, 1, 0],  # Event, Censored, Event, Censored
                "DAYS_FIRST_EVENT_MI": [10, 15, 20, 30],  # Days for each patient
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        result = tte._build_aggregated_risk_table()

        # At day 10: S = 3/4 = 0.75
        surv_at_10 = result[result["Timeline"] == 10.0]["Survival_Probability"].iloc[0]
        assert abs(surv_at_10 - 0.75) < 0.001

        # At day 20: S = 0.75 * (1/2) = 0.375
        surv_at_20 = result[result["Timeline"] == 20.0]["Survival_Probability"].iloc[0]
        assert abs(surv_at_20 - 0.375) < 0.001

        # Verify at-risk counts decrease
        at_risk_values = result["At_Risk"].values
        # At-risk should be monotonically decreasing or equal
        assert all(
            at_risk_values[i] >= at_risk_values[i + 1]
            for i in range(len(at_risk_values) - 1)
        )

    def test_survival_probability_monotonically_decreasing(self):
        """
        Test that survival probability never increases over time.

        This is a fundamental property of the Kaplan-Meier estimator:
        S(t) must be monotonically non-increasing.
        """
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # Create dataset with multiple events
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 1, 1, 1, 0, 0],
                "DAYS_FIRST_EVENT_MI": [5, 10, 15, 25, 30, 40],
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        result = tte._build_aggregated_risk_table()

        # Sort by timeline to ensure proper order
        result = result.sort_values("Timeline").reset_index(drop=True)

        # Check that survival probability never increases
        surv_probs = result["Survival_Probability"].values
        for i in range(len(surv_probs) - 1):
            assert (
                surv_probs[i] >= surv_probs[i + 1]
            ), f"Survival probability increased from {surv_probs[i]} to {surv_probs[i+1]}"

    def test_at_risk_count_decreases_correctly(self):
        """
        Test that the at-risk count decreases correctly after events and censoring.

        At-risk count should:
        - Start at total number of patients
        - Decrease by 1 for each event
        - Decrease by 1 for each censoring
        """
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # 6 patients: 4 events, 2 censored
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 0, 1, 1, 0, 1],
                "DAYS_FIRST_EVENT_MI": [10, 15, 20, 25, 30, 35],
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        result = tte._build_aggregated_risk_table()
        result = result.sort_values("Timeline").reset_index(drop=True)

        # First row should have all patients at risk
        assert result.iloc[0]["At_Risk"] == 6

        # Verify at-risk count decreases
        at_risk_counts = result["At_Risk"].values
        for i in range(len(at_risk_counts) - 1):
            # At risk should decrease or stay same (never increase)
            assert at_risk_counts[i] >= at_risk_counts[i + 1]

    def test_event_count_accuracy(self):
        """
        Test that events are counted correctly at each time point.

        Each event time should have exactly the number of events that occurred.
        """
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # Create dataset where we know exact event counts
        # 2 events at day 10, 1 event at day 20, 1 censored at day 15
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 1, 0, 1],
                "DAYS_FIRST_EVENT_MI": [10, 10, 15, 20],  # Tied events at day 10
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        result = tte._build_aggregated_risk_table()

        # At day 10: should have 2 events
        events_at_10 = result[result["Timeline"] == 10.0]["Events"].iloc[0]
        assert events_at_10 == 2

        # At day 15: should have 0 events (censoring)
        events_at_15 = result[result["Timeline"] == 15.0]["Events"].iloc[0]
        assert events_at_15 == 0

        # At day 20: should have 1 event
        events_at_20 = result[result["Timeline"] == 20.0]["Events"].iloc[0]
        assert events_at_20 == 1

    def test_censored_count_accuracy(self):
        """
        Test that censored observations are counted correctly.

        Note: In the real TimeToEvent, INDICATOR=0 means the patient was censored
        (either by right censoring phenotype, end of study, or end of follow-up).
        Here we're testing that the aggregation correctly counts these censored observations.
        """
        tte = TimeToEvent(
            right_censor_phenotypes=[],  # Censoring represented in INDICATOR column
            end_of_study_period=datetime(2024, 12, 31),
        )

        # 5 patients: 3 events, 2 censored
        # In reality, censoring would come from right_censor_phenotypes or end_of_study_period
        # Here we're testing the aggregation logic assumes _tte_table is correctly built
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [
                    1,
                    0,
                    1,
                    0,
                    1,
                ],  # Events, Censored, Event, Censored, Event
                "DAYS_FIRST_EVENT_MI": [10, 15, 20, 25, 30],
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        result = tte._build_aggregated_risk_table()

        # Count total censored observations
        total_censored = result["Censored"].sum()
        assert total_censored == 2

        # Verify censoring happens at correct times
        censored_at_15 = result[result["Timeline"] == 15.0]["Censored"].iloc[0]
        assert censored_at_15 == 1

        censored_at_25 = result[result["Timeline"] == 25.0]["Censored"].iloc[0]
        assert censored_at_25 == 1

    def test_km_starts_at_probability_one(self):
        """
        Test that Kaplan-Meier curve starts at probability 1.0.

        At time 0 (or the earliest time), all patients should be alive,
        so survival probability should be 1.0.
        """
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 1, 0],
                "DAYS_FIRST_EVENT_MI": [10, 20, 30],
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        kmf = tte.fit_kaplan_meier_for_phenotype(mock_phenotype)

        # Check that survival function starts at 1.0
        first_survival_prob = kmf.survival_function_.iloc[0].values[0]
        assert abs(first_survival_prob - 1.0) < 0.001

    def test_all_events_drives_survival_to_near_zero(self):
        """
        Test that if all patients have events, survival probability approaches 0.
        """
        tte = TimeToEvent(
            right_censor_phenotypes=[],
            end_of_study_period=datetime(2024, 12, 31),
        )

        # 5 patients (5 rows), all experience the MI event (no censoring)
        # Each row represents one patient with their event indicator and time to event
        tte._tte_table = pd.DataFrame(
            {
                "INDICATOR_MI": [1, 1, 1, 1, 1],  # All 5 patients had MI
                "DAYS_FIRST_EVENT_MI": [
                    10,
                    20,
                    30,
                    40,
                    50,
                ],  # Days to MI for each patient
            }
        )

        mock_phenotype = Mock()
        mock_phenotype.name = "MI"

        mock_cohort = Mock()
        mock_cohort.outcomes = [mock_phenotype]
        tte.cohort = mock_cohort

        result = tte._build_aggregated_risk_table()

        # Final survival probability should be 0 (all patients experienced event)
        final_survival = result.iloc[-1]["Survival_Probability"]
        assert abs(final_survival - 0.0) < 0.001
