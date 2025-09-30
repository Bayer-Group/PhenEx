"""
Unit tests for Table2 reporter.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock

from phenex.reporting.table2 import Table2


class MockTable:
    """Mock table for testing."""

    def __init__(self, data):
        self.data = data

    def filter(self, condition):
        return self

    def select(self, columns):
        return MockTable(self.data[columns])

    def distinct(self):
        return MockTable(self.data.drop_duplicates())

    def to_pandas(self):
        return self.data


class MockPhenotype:
    """Mock phenotype for testing."""

    def __init__(self, name, data):
        self.name = name
        self._table = MockTable(data)

    def execute(self, subset_tables_index):
        pass

    @property
    def table(self):
        return self._table


class MockCohort:
    """Mock cohort for testing."""

    def __init__(self, cohort_data, outcomes):
        self.index_table = MockTable(cohort_data)
        self.index_table.BOOLEAN = True
        self.outcomes = outcomes
        self.subset_tables_index = None


class TestTable2:
    """Test cases for Table2 reporter."""

    def test_exact_person_time_calculation(self):
        """Test Table2 with fixed event times for exact person-time calculation."""
        # Test parameters
        n_exposed = 1000
        n_unexposed = 1000
        follow_up_days = 730  # 2 years
        exposed_events = 100
        unexposed_events = 40

        # Fixed event times for exact calculation
        exposed_event_days = [
            100 + i * 6 for i in range(exposed_events)
        ]  # Days 100, 106, 112...
        unexposed_event_days = [
            150 + i * 14 for i in range(unexposed_events)
        ]  # Days 150, 164, 178...

        # Calculate expected person-time exactly
        exposed_person_time = (n_exposed - exposed_events) * follow_up_days + sum(
            exposed_event_days
        )
        unexposed_person_time = (n_unexposed - unexposed_events) * follow_up_days + sum(
            unexposed_event_days
        )

        exposed_person_years = exposed_person_time / 365.25
        unexposed_person_years = unexposed_person_time / 365.25

        expected_exposed_rate = (exposed_events / exposed_person_years) * 100
        expected_unexposed_rate = (unexposed_events / unexposed_person_years) * 100

        # Create test data
        outcome, exposure, cohort = self._create_fixed_time_test_data(
            n_exposed,
            n_unexposed,
            exposed_events,
            unexposed_events,
            exposed_event_days,
            unexposed_event_days,
            follow_up_days,
        )

        # Run Table2 analysis
        table2 = Table2(
            exposure=exposure, time_points=[follow_up_days], confidence_level=0.95
        )

        results = table2.execute(cohort)

        # Validate results
        assert not results.empty, "Table2 should generate results"
        result = results.iloc[0]

        # Check incidence rates (should be very precise with fixed event times)
        exposed_rate_diff = abs(
            expected_exposed_rate - result["Exposed_Incidence_Rate"]
        )
        unexposed_rate_diff = abs(
            expected_unexposed_rate - result["Unexposed_Incidence_Rate"]
        )

        assert (
            exposed_rate_diff < 0.01
        ), f"Exposed incidence rate should be precise. Expected: {expected_exposed_rate:.3f}, Got: {result['Exposed_Incidence_Rate']:.3f}"
        assert (
            unexposed_rate_diff < 0.01
        ), f"Unexposed incidence rate should be precise. Expected: {expected_unexposed_rate:.3f}, Got: {result['Unexposed_Incidence_Rate']:.3f}"

        # Check event counts
        assert result["N_Exposed_Events"] == exposed_events
        assert result["N_Unexposed_Events"] == unexposed_events

    def test_poisson_generated_events(self):
        """Test Table2 with Poisson-distributed events to validate incidence rate calculations."""
        # Test parameters
        n_exposed = 10000
        n_unexposed = 10000
        follow_up_years = 2.0
        target_exposed_rate = 5.0  # per 100 patient-years
        target_unexposed_rate = 2.0  # per 100 patient-years

        # Generate events using Poisson distribution
        np.random.seed(42)  # For reproducible results

        exposed_person_years = n_exposed * follow_up_years
        unexposed_person_years = n_unexposed * follow_up_years

        # Expected number of events based on incidence rates
        expected_exposed_events = (target_exposed_rate / 100) * exposed_person_years
        expected_unexposed_events = (
            target_unexposed_rate / 100
        ) * unexposed_person_years

        # Generate actual events using Poisson
        actual_exposed_events = np.random.poisson(expected_exposed_events)
        actual_unexposed_events = np.random.poisson(expected_unexposed_events)

        # Create test data with Poisson-generated events
        outcome, exposure, cohort = self._create_poisson_test_data(
            n_exposed,
            n_unexposed,
            actual_exposed_events,
            actual_unexposed_events,
            int(follow_up_years * 365.25),
        )

        # Run Table2 analysis
        table2 = Table2(
            exposure=exposure,
            time_points=[int(follow_up_years * 365.25)],
            confidence_level=0.95,
        )

        results = table2.execute(cohort)

        # Validate results
        assert not results.empty, "Table2 should generate results"
        result = results.iloc[0]

        # Calculate expected incidence rates based on actual events and person-time
        # (accounting for reduced person-time due to events)
        expected_exposed_person_time = exposed_person_years - (
            actual_exposed_events * follow_up_years / 2
        )  # Approximate
        expected_unexposed_person_time = unexposed_person_years - (
            actual_unexposed_events * follow_up_years / 2
        )  # Approximate

        expected_exposed_rate_adjusted = (
            actual_exposed_events / expected_exposed_person_time
        ) * 100
        expected_unexposed_rate_adjusted = (
            actual_unexposed_events / expected_unexposed_person_time
        ) * 100

        # Check that incidence rates are close (within 10% due to approximation)
        exposed_rate_ratio = (
            result["Exposed_Incidence_Rate"] / expected_exposed_rate_adjusted
        )
        unexposed_rate_ratio = (
            result["Unexposed_Incidence_Rate"] / expected_unexposed_rate_adjusted
        )

        assert (
            0.9 < exposed_rate_ratio < 1.1
        ), f"Exposed incidence rate ratio should be close to 1.0, got {exposed_rate_ratio:.3f}"
        assert (
            0.9 < unexposed_rate_ratio < 1.1
        ), f"Unexposed incidence rate ratio should be close to 1.0, got {unexposed_rate_ratio:.3f}"

        # Check event counts match exactly
        assert result["N_Exposed_Events"] == actual_exposed_events
        assert result["N_Unexposed_Events"] == actual_unexposed_events

    def test_odds_ratio_calculation(self):
        """Test odds ratio calculation with known 2x2 contingency table."""
        # Simple test case with known odds ratio
        n_exposed = 1000
        n_unexposed = 1000
        exposed_events = 200  # 20% event rate
        unexposed_events = 100  # 10% event rate

        # Expected odds ratio = (200/800) / (100/900) = 0.25 / 0.111 = 2.25
        expected_odds_ratio = (200 * 900) / (800 * 100)  # 2.25

        outcome, exposure, cohort = self._create_fixed_events_test_data(
            n_exposed, n_unexposed, exposed_events, unexposed_events, 365
        )

        table2 = Table2(exposure=exposure, time_points=[365], confidence_level=0.95)
        results = table2.execute(cohort)

        assert not results.empty
        result = results.iloc[0]

        # Check odds ratio (should be exact)
        assert (
            abs(result["Odds_Ratio"] - expected_odds_ratio) < 0.01
        ), f"Expected OR {expected_odds_ratio:.3f}, got {result['Odds_Ratio']:.3f}"

    def test_confidence_interval_calculation(self):
        """Test that confidence intervals are calculated and reasonable."""
        outcome, exposure, cohort = self._create_simple_test_data()

        table2 = Table2(exposure=exposure, time_points=[365], confidence_level=0.95)
        results = table2.execute(cohort)

        assert not results.empty
        result = results.iloc[0]

        # Check that confidence interval exists and is reasonable
        assert "95% CI" in result
        ci_str = result["95% CI"]
        assert " - " in ci_str  # Should be in format "lower - upper"

        # Parse CI bounds and check they're reasonable
        ci_lower, ci_upper = map(float, ci_str.split(" - "))
        assert ci_lower < result["Odds_Ratio"] < ci_upper
        assert ci_lower > 0  # Odds ratios should be positive

    def test_multiple_time_points(self):
        """Test Table2 with multiple time points."""
        outcome, exposure, cohort = self._create_simple_test_data()

        time_points = [90, 180, 365, 730]
        table2 = Table2(
            exposure=exposure, time_points=time_points, confidence_level=0.95
        )
        results = table2.execute(cohort)

        # Should have one row per time point
        assert len(results) == len(time_points)
        assert set(results["Time_Point_Days"]) == set(time_points)

    def test_no_outcomes_cohort(self):
        """Test Table2 with cohort that has no outcomes."""
        exposure = self._create_mock_exposure(100, 100)
        cohort = MockCohort(
            pd.DataFrame(
                {
                    "PERSON_ID": list(range(1, 201)),
                    "EVENT_DATE": [pd.to_datetime("2020-01-01")] * 200,
                    "BOOLEAN": [True] * 200,
                }
            ),
            outcomes=[],  # No outcomes
        )

        table2 = Table2(exposure=exposure, time_points=[365])
        results = table2.execute(cohort)

        assert results.empty, "Should return empty DataFrame when no outcomes"

    def test_censoring_with_death(self):
        """Test Table2 with right censoring from death events."""
        # Create outcome, exposure, and death phenotype
        outcome, exposure, cohort = self._create_simple_test_data()

        # Add death events that occur before some outcomes
        death_events = []
        for person_id in range(1, 101):  # Some deaths in exposed group
            if person_id % 10 == 0:  # Every 10th person dies at day 200
                death_events.append(
                    {
                        "PERSON_ID": person_id,
                        "EVENT_DATE": pd.to_datetime("2020-01-01")
                        + timedelta(days=200),
                        "BOOLEAN": True,
                    }
                )
            else:
                death_events.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        death_phenotype = MockPhenotype("death", pd.DataFrame(death_events))

        table2 = Table2(
            exposure=exposure,
            time_points=[365],
            right_censor_phenotypes=[death_phenotype],
        )

        results = table2.execute(cohort)

        assert not results.empty
        # With censoring, person-time should be reduced
        result = results.iloc[0]
        expected_max_person_years = 200 * 1.0  # 200 people * 1 year
        assert result["Exposed_Time_Under_Risk"] < expected_max_person_years * 100

    def _create_fixed_time_test_data(
        self,
        n_exposed,
        n_unexposed,
        exposed_events,
        unexposed_events,
        exposed_event_days,
        unexposed_event_days,
        follow_up_days,
    ):
        """Create test data with fixed event times."""
        base_date = pd.to_datetime("2020-01-01")

        # Create outcome data
        outcome_rows = []

        # Exposed patients (IDs 1 to n_exposed)
        for i, person_id in enumerate(range(1, n_exposed + 1)):
            if i < exposed_events:
                event_date = base_date + timedelta(days=exposed_event_days[i])
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": event_date, "BOOLEAN": True}
                )
            else:
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        # Unexposed patients (IDs n_exposed+1 to n_exposed+n_unexposed)
        for i, person_id in enumerate(
            range(n_exposed + 1, n_exposed + n_unexposed + 1)
        ):
            if i < unexposed_events:
                event_date = base_date + timedelta(days=unexposed_event_days[i])
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": event_date, "BOOLEAN": True}
                )
            else:
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_rows))
        exposure = self._create_mock_exposure(n_exposed, n_unexposed)
        cohort = self._create_mock_cohort(n_exposed + n_unexposed, [outcome])

        return outcome, exposure, cohort

    def _create_poisson_test_data(
        self, n_exposed, n_unexposed, exposed_events, unexposed_events, follow_up_days
    ):
        """Create test data with Poisson-distributed event times."""
        base_date = pd.to_datetime("2020-01-01")
        outcome_rows = []

        # Exposed patients with random event times
        exposed_event_patients = np.random.choice(
            range(1, n_exposed + 1), exposed_events, replace=False
        )
        for person_id in range(1, n_exposed + 1):
            if person_id in exposed_event_patients:
                event_day = np.random.randint(1, follow_up_days + 1)
                event_date = base_date + timedelta(days=event_day)
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": event_date, "BOOLEAN": True}
                )
            else:
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        # Unexposed patients with random event times
        unexposed_event_patients = np.random.choice(
            range(n_exposed + 1, n_exposed + n_unexposed + 1),
            unexposed_events,
            replace=False,
        )
        for person_id in range(n_exposed + 1, n_exposed + n_unexposed + 1):
            if person_id in unexposed_event_patients:
                event_day = np.random.randint(1, follow_up_days + 1)
                event_date = base_date + timedelta(days=event_day)
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": event_date, "BOOLEAN": True}
                )
            else:
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_rows))
        exposure = self._create_mock_exposure(n_exposed, n_unexposed)
        cohort = self._create_mock_cohort(n_exposed + n_unexposed, [outcome])

        return outcome, exposure, cohort

    def _create_fixed_events_test_data(
        self, n_exposed, n_unexposed, exposed_events, unexposed_events, follow_up_days
    ):
        """Create test data with fixed number of events (for OR testing)."""
        base_date = pd.to_datetime("2020-01-01")
        outcome_rows = []

        # Exposed patients - first N have events, rest don't
        for person_id in range(1, n_exposed + 1):
            if person_id <= exposed_events:
                event_date = base_date + timedelta(days=100)  # Fixed day
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": event_date, "BOOLEAN": True}
                )
            else:
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        # Unexposed patients - first N have events, rest don't
        for person_id in range(n_exposed + 1, n_exposed + n_unexposed + 1):
            if person_id <= n_exposed + unexposed_events:
                event_date = base_date + timedelta(days=100)  # Fixed day
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": event_date, "BOOLEAN": True}
                )
            else:
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_rows))
        exposure = self._create_mock_exposure(n_exposed, n_unexposed)
        cohort = self._create_mock_cohort(n_exposed + n_unexposed, [outcome])

        return outcome, exposure, cohort

    def _create_simple_test_data(self):
        """Create simple test data for basic functionality tests."""
        return self._create_fixed_events_test_data(100, 100, 20, 10, 365)

    def _create_mock_exposure(self, n_exposed, n_unexposed):
        """Create mock exposure phenotype."""
        exposure_rows = []

        # Exposed patients
        for person_id in range(1, n_exposed + 1):
            exposure_rows.append({"PERSON_ID": person_id, "BOOLEAN": True})

        # Unexposed patients
        for person_id in range(n_exposed + 1, n_exposed + n_unexposed + 1):
            exposure_rows.append({"PERSON_ID": person_id, "BOOLEAN": False})

        return MockPhenotype("treatment", pd.DataFrame(exposure_rows))

    def _create_mock_cohort(self, total_patients, outcomes):
        """Create mock cohort."""
        base_date = pd.to_datetime("2020-01-01")
        cohort_rows = []

        for person_id in range(1, total_patients + 1):
            cohort_rows.append(
                {"PERSON_ID": person_id, "EVENT_DATE": base_date, "BOOLEAN": True}
            )

        return MockCohort(pd.DataFrame(cohort_rows), outcomes)
