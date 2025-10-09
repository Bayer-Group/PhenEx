"""
Unit tests for Table2 reporter.
"""

import pytest
import pandas as pd
import numpy as np
import ibis
from datetime import datetime, timedelta
from unittest.mock import Mock

from phenex.reporting.table2 import Table2


class MockIbisTable:
    """Mock Ibis table for testing."""

    def __init__(self, data):
        if isinstance(data, pd.DataFrame):
            self._ibis_table = ibis.memtable(data)
        else:
            self._ibis_table = data

    def filter(self, condition):
        return MockIbisTable(self._ibis_table.filter(condition))

    def select(self, columns):
        return MockIbisTable(self._ibis_table.select(columns))

    def distinct(self):
        return MockIbisTable(self._ibis_table.distinct())

    def left_join(self, other, *args, **kwargs):
        if isinstance(other, MockIbisTable):
            other_table = other._ibis_table
        else:
            other_table = other
        return MockIbisTable(self._ibis_table.left_join(other_table, *args, **kwargs))

    def mutate(self, **kwargs):
        return MockIbisTable(self._ibis_table.mutate(**kwargs))

    def aggregate(self, *args, **kwargs):
        return MockIbisTable(self._ibis_table.aggregate(*args, **kwargs))

    def drop(self, columns):
        return MockIbisTable(self._ibis_table.drop(columns))

    def execute(self):
        return self._ibis_table.execute()

    def __getattr__(self, name):
        return getattr(self._ibis_table, name)


class MockPhenotype:
    """Mock phenotype for testing."""

    def __init__(self, name, data):
        self.name = name
        self._table = MockIbisTable(data)

    def execute(self, subset_tables_index):
        pass

    @property
    def table(self):
        return self._table


class MockCohort:
    """Mock cohort for testing."""

    def __init__(self, cohort_data, outcomes):
        self.index_table = MockIbisTable(cohort_data)
        self.outcomes = outcomes
        self.subset_tables_index = None


class TestTable2:
    """Test cases for Table2 reporter."""

    def test_exact_person_time_calculation(self):
        """Test Table2 with fixed event times for exact person-time calculation."""
        # Test parameters
        n_cohort = 1000
        follow_up_days = 730  # 2 years
        cohort_events = 100

        # Fixed event times for exact calculation
        event_days = [
            100 + i * 6 for i in range(cohort_events)
        ]  # Days 100, 106, 112...

        # Calculate expected person-time exactly
        cohort_person_time = (n_cohort - cohort_events) * follow_up_days + sum(
            event_days
        )
        cohort_person_years = cohort_person_time / 365.25
        expected_rate = (cohort_events / cohort_person_years) * 100

        # Create test data
        outcome, cohort = self._create_fixed_time_test_data(
            n_cohort,
            cohort_events,
            event_days,
            follow_up_days,
        )

        # Run Table2 analysis
        table2 = Table2(time_points=[follow_up_days])

        results = table2.execute(cohort)

        # Validate results
        assert not results.empty, "Table2 should generate results"
        result = results.iloc[0]

        # Check incidence rates (should be very precise with fixed event times)
        rate_diff = abs(expected_rate - result["Incidence_Rate"])

        assert (
            rate_diff < 0.01
        ), f"Incidence rate should be precise. Expected: {expected_rate:.3f}, Got: {result['Incidence_Rate']:.3f}"

        # Check event counts
        assert result["N_Events"] == cohort_events
        assert result["N_Total"] == n_cohort

    def test_poisson_generated_events(self):
        """Test Table2 with Poisson-distributed events to validate incidence rate calculations."""
        # Test parameters
        n_cohort = 10000
        follow_up_years = 2.0
        target_rate = 3.5  # per 100 patient-years

        # Generate events using Poisson distribution
        np.random.seed(42)  # For reproducible results

        cohort_person_years = n_cohort * follow_up_years

        # Expected number of events based on incidence rate
        expected_events = (target_rate / 100) * cohort_person_years

        # Generate actual events using Poisson
        actual_events = np.random.poisson(expected_events)

        # Create test data with Poisson-generated events
        outcome, cohort = self._create_poisson_test_data(
            n_cohort,
            actual_events,
            int(follow_up_years * 365.25),
        )

        # Run Table2 analysis
        table2 = Table2(
            time_points=[int(follow_up_years * 365.25)],
        )

        results = table2.execute(cohort)

        # Validate results
        assert not results.empty, "Table2 should generate results"
        result = results.iloc[0]

        # Calculate expected incidence rate based on actual events and person-time
        # (accounting for reduced person-time due to events)
        expected_person_time = cohort_person_years - (
            actual_events * follow_up_years / 2
        )  # Approximate

        expected_rate_adjusted = (actual_events / expected_person_time) * 100

        # Check that incidence rate is close (within 10% due to approximation)
        rate_ratio = result["Incidence_Rate"] / expected_rate_adjusted

        assert (
            0.9 < rate_ratio < 1.1
        ), f"Incidence rate ratio should be close to 1.0, got {rate_ratio:.3f}"

        # Check event counts match exactly
        assert result["N_Events"] == actual_events
        assert result["N_Total"] == n_cohort

    def test_basic_cohort_analysis(self):
        """Test basic cohort analysis with known event rate."""
        # Simple test case
        n_cohort = 1000
        cohort_events = 200  # 20% event rate
        follow_up_days = 365

        outcome, cohort = self._create_fixed_events_test_data(
            n_cohort, cohort_events, follow_up_days
        )

        table2 = Table2(time_points=[365])
        results = table2.execute(cohort)

        assert not results.empty
        result = results.iloc[0]

        # Check basic counts
        assert result["N_Events"] == cohort_events
        assert result["N_Total"] == n_cohort
        assert result["Time_Point_Days"] == 365

        # Check that incidence rate is reasonable
        expected_person_years = n_cohort * 1.0  # Approximately 1 year each
        expected_rate = (cohort_events / expected_person_years) * 100
        assert (
            abs(result["Incidence_Rate"] - expected_rate) < 5.0
        )  # Within 5% per 100 patient-years

    def test_column_structure(self):
        """Test that the result DataFrame has the expected columns."""
        outcome, cohort = self._create_simple_test_data()

        table2 = Table2(time_points=[365])
        results = table2.execute(cohort)

        assert not results.empty

        # Check expected columns are present
        expected_columns = [
            "Outcome",
            "Time_Point_Days",
            "N_Events",
            "N_Total",
            "Time_Under_Risk",
            "Incidence_Rate",
        ]

        for col in expected_columns:
            assert col in results.columns, f"Missing expected column: {col}"

        # Check that old exposure-related columns are not present
        old_columns = [
            "N_Exposed_Events",
            "N_Unexposed_Events",
            "Odds_Ratio",
            "CI_Lower",
            "CI_Upper",
            "P_Value",
        ]
        for col in old_columns:
            assert (
                col not in results.columns
            ), f"Old column should not be present: {col}"

    def test_multiple_time_points(self):
        """Test Table2 with multiple time points."""
        outcome, cohort = self._create_simple_test_data()

        time_points = [90, 180, 365, 730]
        table2 = Table2(time_points=time_points)
        results = table2.execute(cohort)

        # Should have one row per time point
        assert len(results) == len(time_points)
        assert set(results["Time_Point_Days"]) == set(time_points)

    def test_no_outcomes_cohort(self):
        """Test Table2 with cohort that has no outcomes."""
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

        table2 = Table2(time_points=[365])
        results = table2.execute(cohort)

        assert results.empty, "Should return empty DataFrame when no outcomes"

    def test_censoring_with_death(self):
        """Test Table2 with right censoring from death events."""
        # Create outcome and cohort
        outcome, cohort = self._create_simple_test_data()

        # Add death events that occur before some outcomes
        death_events = []
        base_date = pd.to_datetime("2020-01-01").date()
        for person_id in range(1, 201):  # All patients in cohort
            if person_id % 10 == 0:  # Every 10th person dies at day 200
                death_events.append(
                    {
                        "PERSON_ID": person_id,
                        "EVENT_DATE": base_date + timedelta(days=200),
                        "BOOLEAN": True,
                    }
                )
            else:
                death_events.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        death_phenotype = MockPhenotype("death", pd.DataFrame(death_events))

        table2 = Table2(
            time_points=[365],
            right_censor_phenotypes=[death_phenotype],
        )

        results = table2.execute(cohort)

        assert not results.empty
        # With censoring, person-time should be reduced
        result = results.iloc[0]
        expected_max_person_years = 200 * 1.0  # 200 people * 1 year
        assert result["Time_Under_Risk"] < expected_max_person_years

    def test_manual_calculation_validation(self):
        """Test with simple known data to verify calculations manually."""
        # Create simple test case:
        # - 10 patients
        # - 3 have events at specific days
        # - Follow-up: 365 days

        base_date = pd.to_datetime("2020-01-01").date()

        # Cohort: 10 patients, all start on Jan 1, 2020
        cohort_data = []
        for i in range(1, 11):
            cohort_data.append(
                {"PERSON_ID": i, "EVENT_DATE": base_date, "BOOLEAN": True}
            )

        # Outcomes: Patient 1 has event at day 100, Patient 2 at day 200, Patient 3 at day 300
        outcome_data = []
        for i in range(1, 11):
            if i == 1:
                outcome_data.append(
                    {
                        "PERSON_ID": i,
                        "EVENT_DATE": base_date + timedelta(days=100),
                        "BOOLEAN": True,
                    }
                )
            elif i == 2:
                outcome_data.append(
                    {
                        "PERSON_ID": i,
                        "EVENT_DATE": base_date + timedelta(days=200),
                        "BOOLEAN": True,
                    }
                )
            elif i == 3:
                outcome_data.append(
                    {
                        "PERSON_ID": i,
                        "EVENT_DATE": base_date + timedelta(days=300),
                        "BOOLEAN": True,
                    }
                )
            else:
                outcome_data.append(
                    {"PERSON_ID": i, "EVENT_DATE": None, "BOOLEAN": False}
                )

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_data))
        cohort = MockCohort(pd.DataFrame(cohort_data), [outcome])

        # Run Table2
        table2 = Table2(time_points=[365])
        results = table2.execute(cohort)

        # Manual calculation:
        # Patient 1: 100 days follow-up (event at day 100)
        # Patient 2: 200 days follow-up (event at day 200)
        # Patient 3: 300 days follow-up (event at day 300)
        # Patients 4-10: 365 days each (no events)

        expected_total_days = 100 + 200 + 300 + (7 * 365)
        expected_person_years = expected_total_days / 365.25
        expected_events = 3
        expected_rate = (expected_events / expected_person_years) * 100

        # Check results
        result = results.iloc[0]

        # Validate
        assert result["N_Events"] == expected_events
        assert result["N_Total"] == 10
        assert abs(result["Time_Under_Risk"] - expected_person_years) < 0.1
        assert abs(result["Incidence_Rate"] - expected_rate) < 1.0

    def test_precise_censoring_calculation(self):
        """Test censoring logic with precise manual calculation."""
        base_date = pd.to_datetime("2020-01-01").date()

        # Cohort: 5 patients
        cohort_data = []
        for i in range(1, 6):
            cohort_data.append(
                {"PERSON_ID": i, "EVENT_DATE": base_date, "BOOLEAN": True}
            )

        # Outcomes: Patient 1 has event at day 300, others have no events
        outcome_data = []
        for i in range(1, 6):
            if i == 1:
                outcome_data.append(
                    {
                        "PERSON_ID": i,
                        "EVENT_DATE": base_date + timedelta(days=300),
                        "BOOLEAN": True,
                    }
                )
            else:
                outcome_data.append(
                    {"PERSON_ID": i, "EVENT_DATE": None, "BOOLEAN": False}
                )

        # Censoring: Patient 2 dies at day 100, Patient 3 at day 200
        censor_data = []
        for i in range(1, 6):
            if i == 2:
                censor_data.append(
                    {
                        "PERSON_ID": i,
                        "EVENT_DATE": base_date + timedelta(days=100),
                        "BOOLEAN": True,
                    }
                )
            elif i == 3:
                censor_data.append(
                    {
                        "PERSON_ID": i,
                        "EVENT_DATE": base_date + timedelta(days=200),
                        "BOOLEAN": True,
                    }
                )
            else:
                censor_data.append(
                    {"PERSON_ID": i, "EVENT_DATE": None, "BOOLEAN": False}
                )

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_data))
        death = MockPhenotype("death", pd.DataFrame(censor_data))
        cohort = MockCohort(pd.DataFrame(cohort_data), [outcome])

        # Run Table2 with censoring
        table2 = Table2(time_points=[365], right_censor_phenotypes=[death])
        results = table2.execute(cohort)

        # Manual calculation with censoring:
        # Patient 1: 300 days (event at day 300)
        # Patient 2: 100 days (dies at day 100, censored)
        # Patient 3: 200 days (dies at day 200, censored)
        # Patient 4: 365 days (no event, no censoring)
        # Patient 5: 365 days (no event, no censoring)

        expected_total_days = 300 + 100 + 200 + 365 + 365
        expected_person_years = expected_total_days / 365.25
        expected_events = 1  # Only patient 1 has event
        expected_rate = (expected_events / expected_person_years) * 100

        # Check results
        result = results.iloc[0]

        # Validate
        assert result["N_Events"] == expected_events
        assert result["N_Total"] == 5
        assert abs(result["Time_Under_Risk"] - expected_person_years) < 0.1
        assert abs(result["Incidence_Rate"] - expected_rate) < 1.0

    def _create_fixed_time_test_data(
        self,
        n_cohort,
        cohort_events,
        event_days,
        follow_up_days,
    ):
        """Create test data with fixed event times."""
        base_date = pd.to_datetime("2020-01-01").date()

        # Create outcome data
        outcome_rows = []

        # Cohort patients (IDs 1 to n_cohort)
        for i, person_id in enumerate(range(1, n_cohort + 1)):
            if i < cohort_events:
                event_date = base_date + timedelta(days=event_days[i])
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": event_date, "BOOLEAN": True}
                )
            else:
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_rows))
        cohort = self._create_mock_cohort(n_cohort, [outcome])

        return outcome, cohort

    def _create_poisson_test_data(self, n_cohort, cohort_events, follow_up_days):
        """Create test data with Poisson-distributed event times."""
        base_date = pd.to_datetime("2020-01-01").date()
        outcome_rows = []

        # Cohort patients with random event times
        event_patients = np.random.choice(
            range(1, n_cohort + 1), cohort_events, replace=False
        )
        for person_id in range(1, n_cohort + 1):
            if person_id in event_patients:
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
        cohort = self._create_mock_cohort(n_cohort, [outcome])

        return outcome, cohort

    def _create_fixed_events_test_data(self, n_cohort, cohort_events, follow_up_days):
        """Create test data with fixed number of events."""
        base_date = pd.to_datetime("2020-01-01").date()
        outcome_rows = []

        # Cohort patients - first N have events, rest don't
        for person_id in range(1, n_cohort + 1):
            if person_id <= cohort_events:
                event_date = base_date + timedelta(days=100)  # Fixed day
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": event_date, "BOOLEAN": True}
                )
            else:
                outcome_rows.append(
                    {"PERSON_ID": person_id, "EVENT_DATE": None, "BOOLEAN": False}
                )

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_rows))
        cohort = self._create_mock_cohort(n_cohort, [outcome])

        return outcome, cohort

    def _create_simple_test_data(self):
        """Create simple test data for basic functionality tests."""
        return self._create_fixed_events_test_data(
            200, 30, 365
        )  # 200 patients, 30 events

    def _create_mock_cohort(self, total_patients, outcomes):
        """Create mock cohort."""
        base_date = pd.to_datetime("2020-01-01").date()
        cohort_rows = []

        for person_id in range(1, total_patients + 1):
            cohort_rows.append(
                {"PERSON_ID": person_id, "EVENT_DATE": base_date, "BOOLEAN": True}
            )

        return MockCohort(pd.DataFrame(cohort_rows), outcomes)
