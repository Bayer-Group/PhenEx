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

    def rename(self, mapping):
        return MockIbisTable(self._ibis_table.rename(mapping))

    def join(self, other, *args, **kwargs):
        if isinstance(other, MockIbisTable):
            other_table = other._ibis_table
        else:
            other_table = other
        return MockIbisTable(self._ibis_table.join(other_table, *args, **kwargs))

    def group_by(self, *args, **kwargs):
        return MockIbisTable(self._ibis_table.group_by(*args, **kwargs))

    def union(self, other, *args, **kwargs):
        if isinstance(other, MockIbisTable):
            other_table = other._ibis_table
        else:
            other_table = other
        return MockIbisTable(self._ibis_table.union(other_table, *args, **kwargs))

    def count(self):
        return self._ibis_table.count()

    def execute(self):
        return self._ibis_table.execute()

    def __getattr__(self, name):
        return getattr(self._ibis_table, name)


class MockPhenotype:
    """Mock phenotype for testing."""

    def __init__(self, name, data):
        self.name = name
        self._table = MockIbisTable(data)
        self.date_col = "EVENT_DATE"  # Standard date column name for phenotypes

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

    @property
    def table(self):
        """Return the index table as the cohort table."""
        return self.index_table


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
        assert result["Time_Point"] == 365

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
            "Time_Point",
            "N_Events",
            "N_Censored",
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
        assert set(results["Time_Point"]) == set(time_points)

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
        assert abs(result["Time_Under_Risk"] - expected_person_years) < 0.1
        assert abs(result["Incidence_Rate"] - expected_rate) < 1.0

    def test_multiple_events_per_patient_first_event_only(self):
        """Test that only the first event per patient is counted when patients have multiple events."""
        base_date = pd.to_datetime("2020-01-01").date()

        # Cohort: 3 patients, all start on Jan 1, 2020
        cohort_data = []
        for i in range(1, 4):
            cohort_data.append(
                {"PERSON_ID": i, "EVENT_DATE": base_date, "BOOLEAN": True}
            )

        # Outcomes:
        # Patient 1: has events at day 50, 100, and 200 (should only count day 50)
        # Patient 2: has events at day 150 and 300 (should only count day 150)
        # Patient 3: has no events
        outcome_data = []

        # Patient 1 - multiple events
        outcome_data.extend(
            [
                {
                    "PERSON_ID": 1,
                    "EVENT_DATE": base_date + timedelta(days=50),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 1,
                    "EVENT_DATE": base_date + timedelta(days=100),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 1,
                    "EVENT_DATE": base_date + timedelta(days=200),
                    "BOOLEAN": True,
                },
            ]
        )

        # Patient 2 - multiple events
        outcome_data.extend(
            [
                {
                    "PERSON_ID": 2,
                    "EVENT_DATE": base_date + timedelta(days=150),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 2,
                    "EVENT_DATE": base_date + timedelta(days=300),
                    "BOOLEAN": True,
                },
            ]
        )

        # Patient 3 - no events
        outcome_data.append({"PERSON_ID": 3, "EVENT_DATE": None, "BOOLEAN": False})

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_data))
        cohort = MockCohort(pd.DataFrame(cohort_data), [outcome])

        # Run Table2
        table2 = Table2(time_points=[365])
        results = table2.execute(cohort)

        # Check results
        result = results.iloc[0]

        # Should only count 2 events (first event for patient 1 and patient 2)
        assert result["N_Events"] == 2, f"Expected 2 events, got {result['N_Events']}"

        # Manual calculation:
        # Patient 1: 50 days follow-up (first event at day 50)
        # Patient 2: 150 days follow-up (first event at day 150)
        # Patient 3: 365 days follow-up (no events)
        expected_total_days = 50 + 150 + 365
        expected_person_years = expected_total_days / 365.25
        expected_events = 2
        expected_rate = (expected_events / expected_person_years) * 100

        # Validate calculations are based on first events only
        assert (
            abs(result["Time_Under_Risk"] - expected_person_years) < 0.1
        ), f"Expected {expected_person_years:.3f} person-years, got {result['Time_Under_Risk']}"
        assert (
            abs(result["Incidence_Rate"] - expected_rate) < 1.0
        ), f"Expected rate {expected_rate:.2f}, got {result['Incidence_Rate']}"

    def test_multiple_censoring_events_per_patient_first_event_only(self):
        """Test that only the first censoring event per patient is used when patients have multiple censoring events."""
        base_date = pd.to_datetime("2020-01-01").date()

        # Cohort: 3 patients, all start on Jan 1, 2020
        cohort_data = []
        for i in range(1, 4):
            cohort_data.append(
                {"PERSON_ID": i, "EVENT_DATE": base_date, "BOOLEAN": True}
            )

        # Simple outcome: Patient 1 has outcome at day 200, others have no outcomes
        outcome_data = []
        for i in range(1, 4):
            if i == 1:
                outcome_data.append(
                    {
                        "PERSON_ID": i,
                        "EVENT_DATE": base_date + timedelta(days=200),
                        "BOOLEAN": True,
                    }
                )
            else:
                outcome_data.append(
                    {"PERSON_ID": i, "EVENT_DATE": None, "BOOLEAN": False}
                )

        # Multiple censoring events per patient:
        # Patient 1: censoring events at days 150, 250, 300 (should only use day 150, which comes before outcome at day 200)
        # Patient 2: censoring events at days 100, 200 (should only use day 100)
        # Patient 3: censoring events at days 50, 150, 250 (should only use day 50)
        censor_data = []

        # Patient 1 - multiple censoring events (first at day 150 should censor the outcome at day 200)
        censor_data.extend(
            [
                {
                    "PERSON_ID": 1,
                    "EVENT_DATE": base_date + timedelta(days=150),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 1,
                    "EVENT_DATE": base_date + timedelta(days=250),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 1,
                    "EVENT_DATE": base_date + timedelta(days=300),
                    "BOOLEAN": True,
                },
            ]
        )

        # Patient 2 - multiple censoring events
        censor_data.extend(
            [
                {
                    "PERSON_ID": 2,
                    "EVENT_DATE": base_date + timedelta(days=100),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 2,
                    "EVENT_DATE": base_date + timedelta(days=200),
                    "BOOLEAN": True,
                },
            ]
        )

        # Patient 3 - multiple censoring events
        censor_data.extend(
            [
                {
                    "PERSON_ID": 3,
                    "EVENT_DATE": base_date + timedelta(days=50),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 3,
                    "EVENT_DATE": base_date + timedelta(days=150),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 3,
                    "EVENT_DATE": base_date + timedelta(days=250),
                    "BOOLEAN": True,
                },
            ]
        )

        outcome = MockPhenotype("test_outcome", pd.DataFrame(outcome_data))
        death = MockPhenotype("death", pd.DataFrame(censor_data))
        cohort = MockCohort(pd.DataFrame(cohort_data), [outcome])

        # Run Table2 with censoring
        table2 = Table2(time_points=[365], right_censor_phenotypes=[death])
        results = table2.execute(cohort)

        # Check results
        result = results.iloc[0]

        # Should count 0 events because Patient 1's outcome at day 200 is censored by death at day 150
        assert result["N_Events"] == 0, f"Expected 0 events, got {result['N_Events']}"

        # Manual calculation with first censoring events only:
        # Patient 1: 150 days (censored by first death at day 150, outcome at day 200 doesn't count)
        # Patient 2: 100 days (censored by first death at day 100)
        # Patient 3: 50 days (censored by first death at day 50)
        expected_total_days = 150 + 100 + 50
        expected_person_years = expected_total_days / 365.25
        expected_events = 0
        expected_rate = 0  # No events

        # Validate calculations are based on first censoring events only
        assert (
            abs(result["Time_Under_Risk"] - expected_person_years) < 0.1
        ), f"Expected {expected_person_years:.3f} person-years, got {result['Time_Under_Risk']}"
        assert (
            result["Incidence_Rate"] == expected_rate
        ), f"Expected rate {expected_rate}, got {result['Incidence_Rate']}"

        # All patients should be censored
        assert (
            result["N_Censored"] == 3
        ), f"Expected 3 censored patients, got {result['N_Censored']}"

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

    def test_calculate_time_to_first_post_index_event_method(self):
        """Test the _calculate_time_to_first_post_index_event method directly with various scenarios."""
        base_date = pd.to_datetime("2020-01-01").date()

        # Create index table with 5 patients, all starting on Jan 1, 2020
        index_data = []
        for i in range(1, 6):
            index_data.append({"PERSON_ID": i, "INDEX_DATE": base_date})
        index_table = MockIbisTable(pd.DataFrame(index_data))

        # Create phenotype with various event scenarios:
        # Patient 1: No events (should return None for both date and days)
        # Patient 2: One event at day 100 post-index (should return day 100)
        # Patient 3: Two events at day 50 and day 150 post-index (should return day 50 - first event)
        # Patient 4: One event at day -30 pre-index, one at day 200 post-index (should return day 200 - first POST-index)
        # Patient 5: Two events pre-index at day -50 and day -20 (should return None - no post-index events)

        phenotype_data = []

        # Patient 1: No events
        phenotype_data.append({"PERSON_ID": 1, "EVENT_DATE": None, "BOOLEAN": False})

        # Patient 2: One event at day 100 post-index
        phenotype_data.append(
            {
                "PERSON_ID": 2,
                "EVENT_DATE": base_date + timedelta(days=100),
                "BOOLEAN": True,
            }
        )

        # Patient 3: Two events at day 50 and day 150 post-index (should select day 50)
        phenotype_data.extend(
            [
                {
                    "PERSON_ID": 3,
                    "EVENT_DATE": base_date + timedelta(days=50),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 3,
                    "EVENT_DATE": base_date + timedelta(days=150),
                    "BOOLEAN": True,
                },
            ]
        )

        # Patient 4: One pre-index event (day -30) and one post-index event (day 200)
        # Should select day 200 as first POST-index event
        phenotype_data.extend(
            [
                {
                    "PERSON_ID": 4,
                    "EVENT_DATE": base_date + timedelta(days=-30),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 4,
                    "EVENT_DATE": base_date + timedelta(days=200),
                    "BOOLEAN": True,
                },
            ]
        )

        # Patient 5: Two events pre-index at day -50 and day -20 (should return None)
        phenotype_data.extend(
            [
                {
                    "PERSON_ID": 5,
                    "EVENT_DATE": base_date + timedelta(days=-50),
                    "BOOLEAN": True,
                },
                {
                    "PERSON_ID": 5,
                    "EVENT_DATE": base_date + timedelta(days=-20),
                    "BOOLEAN": True,
                },
            ]
        )

        phenotype = MockPhenotype("test_phenotype", pd.DataFrame(phenotype_data))

        # Create Table2 instance and call the method directly
        table2 = Table2()
        result_table = table2._calculate_time_to_first_post_index_event(
            index_table, [phenotype], "EVENT_DATE", "DAYS_TO_EVENT"
        )

        # Convert to pandas for assertions
        result_df = result_table.execute().sort_values("PERSON_ID")

        # Verify we have 5 patients
        assert len(result_df) == 5

        # Patient 1: No events - should have None for both date and days
        patient1 = result_df[result_df["PERSON_ID"] == 1].iloc[0]
        assert pd.isna(patient1["EVENT_DATE"])
        assert pd.isna(patient1["DAYS_TO_EVENT"])

        # Patient 2: One event at day 100 - should return day 100
        patient2 = result_df[result_df["PERSON_ID"] == 2].iloc[0]
        assert patient2["EVENT_DATE"] == base_date + timedelta(days=100)
        assert patient2["DAYS_TO_EVENT"] == 100

        # Patient 3: Two post-index events - should return first one (day 50)
        patient3 = result_df[result_df["PERSON_ID"] == 3].iloc[0]
        assert patient3["EVENT_DATE"] == base_date + timedelta(days=50)
        assert patient3["DAYS_TO_EVENT"] == 50

        # Patient 4: Pre-index and post-index events - should return first POST-index (day 200)
        patient4 = result_df[result_df["PERSON_ID"] == 4].iloc[0]
        assert patient4["EVENT_DATE"] == base_date + timedelta(days=200)
        assert patient4["DAYS_TO_EVENT"] == 200

        # Patient 5: Only pre-index events - should return None
        patient5 = result_df[result_df["PERSON_ID"] == 5].iloc[0]
        assert pd.isna(patient5["EVENT_DATE"])
        assert pd.isna(patient5["DAYS_TO_EVENT"])

        print("✅ _calculate_time_to_first_post_index_event method test passed!")

    def test_calculate_time_to_first_post_index_event_no_phenotypes(self):
        """Test the method with no phenotypes - should return None for all patients."""
        base_date = pd.to_datetime("2020-01-01").date()

        # Create index table with 3 patients
        index_data = []
        for i in range(1, 4):
            index_data.append({"PERSON_ID": i, "INDEX_DATE": base_date})
        index_table = MockIbisTable(pd.DataFrame(index_data))

        # Test with empty phenotypes list
        table2 = Table2()
        result_table = table2._calculate_time_to_first_post_index_event(
            index_table, [], "EVENT_DATE", "DAYS_TO_EVENT"
        )

        # Convert to pandas for assertions
        result_df = result_table.execute().sort_values("PERSON_ID")

        # Verify we have 3 patients, all with None values
        assert len(result_df) == 3
        for i in range(3):
            patient = result_df.iloc[i]
            assert pd.isna(patient["EVENT_DATE"])
            assert pd.isna(patient["DAYS_TO_EVENT"])

        print("✅ _calculate_time_to_first_post_index_event no phenotypes test passed!")
