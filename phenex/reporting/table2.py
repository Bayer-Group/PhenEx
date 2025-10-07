import pandas as pd
import numpy as np
from typing import List, Optional

from phenex.reporting.reporter import Reporter
from phenex.util import create_logger

logger = create_logger(__name__)


class Table2(Reporter):
    """
    Table2 generates outcome incidence rates and event counts for a cohort at specified time points.

    For each outcome, reports:
    - N events in the cohort
    - Time under risk in 100 patient-years (accounting for censoring)
    - Incidence rate per 100 patient-years

    Time under risk accounts for censoring from competing events (e.g., death) and administrative censoring at end of study period.

    Parameters:
        time_points: List of days from index to evaluate outcomes (e.g., [90, 365])
        right_censor_phenotypes: List of phenotypes for right censoring (e.g., death)
        end_of_study_period: End date of study period for administrative censoring

    Example:
        ```python
        # Simple analysis without censoring
        table2 = Table2(
            time_points=[90, 365, 730],  # 3 months, 1 year, 2 years
        )

        # Analysis with right censoring
        table2_censored = Table2(
            time_points=[90, 365, 730],
            right_censor_phenotypes=[death_phenotype],
            end_of_study_period="2023-12-31"
        )
        results = table2_censored.execute(cohort)  # Uses cohort.outcomes
        ```
    """

    def __init__(
        self,
        time_points: List[int] = [365],  # Default to 1 year
        decimal_places: int = 3,
        pretty_display: bool = True,
        right_censor_phenotypes: Optional[List["Phenotype"]] = None,
        end_of_study_period: Optional[str] = None,
    ):
        super().__init__(decimal_places=decimal_places, pretty_display=pretty_display)
        self.time_points = sorted(time_points)  # Sort time points
        self.right_censor_phenotypes = right_censor_phenotypes or []
        self.end_of_study_period = end_of_study_period

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        """
        Execute Table2 analysis for the provided cohort.

        Args:
            cohort: The cohort containing outcomes

        Returns:
            DataFrame with columns:
            - Outcome: Name of outcome variable
            - Time_Point_Days: Days from index date
            - N_Events: Number of events in cohort
            - N_Total: Total patients in cohort
            - Time_Under_Risk: Follow-up time in patient-years
            - Incidence_Rate: Incidence rate per 100 patient-years
        """
        self.cohort = cohort

        # Get outcomes from cohort like Table1
        if len(cohort.outcomes) == 0:
            logger.info("No outcomes in cohort. Table2 is empty")
            return pd.DataFrame()

        self.outcomes = cohort.outcomes
        logger.info(
            f"Starting Table2 analysis with {len(self.outcomes)} outcomes at {len(self.time_points)} time points"
        )

        # Get cohort index data
        index_data = self._get_cohort_index_data()
        if index_data.empty:
            logger.error("No cohort index data available")
            return pd.DataFrame()

        # Execute right censoring phenotypes
        for phenotype in self.right_censor_phenotypes:
            phenotype.execute(cohort.subset_tables_index)

        # Use index data as analysis data (all patients in cohort)
        analysis_data = index_data
        logger.debug(f"Analysis dataset: {len(analysis_data)} patients")

        # Analyze each outcome at each time point
        results_list = []
        for outcome in self.outcomes:
            for time_point in self.time_points:
                result = self._analyze_outcome_at_timepoint(
                    analysis_data, outcome, time_point
                )
                if result is not None:
                    results_list.append(result)

        # Combine results
        if results_list:
            self.df = pd.DataFrame(results_list)
        else:
            self.df = pd.DataFrame()

        if self.pretty_display and not self.df.empty:
            self._create_pretty_display()

        logger.info("Completed Table2 analysis")
        return self.df

    def _get_cohort_index_data(self) -> pd.DataFrame:
        """Get cohort index dates."""
        try:
            index_data = (
                self.cohort.index_table.filter(self.cohort.index_table.BOOLEAN == True)
                .select(["PERSON_ID", "EVENT_DATE"])
                .distinct()
                .to_pandas()
            )
            index_data = index_data.rename(columns={"EVENT_DATE": "INDEX_DATE"})
            logger.debug(f"Cohort index data: {len(index_data)} patients")
            return index_data
        except Exception as e:
            logger.error(f"Failed to get cohort index data: {e}")
            return pd.DataFrame()

    def _get_outcome_events(
        self, outcome: "Phenotype", analysis_data: pd.DataFrame, time_point: int
    ) -> pd.DataFrame:
        """Get outcome events within specified time from index."""
        try:
            # Get outcome events with dates
            outcome_table = outcome.table.select(
                ["PERSON_ID", "EVENT_DATE", "BOOLEAN"]
            ).distinct()
            outcome_data = outcome_table.to_pandas()

            # Filter to events that occurred (BOOLEAN = True)
            outcome_events = outcome_data[outcome_data["BOOLEAN"] == True].copy()

            if outcome_events.empty:
                logger.debug(f"No events found for outcome {outcome.name}")
                return analysis_data.assign(EVENT_WITHIN_TIMEPOINT=0)

            # Merge with analysis data to get index dates
            events_with_index = outcome_events.merge(
                analysis_data[["PERSON_ID", "INDEX_DATE"]], on="PERSON_ID", how="inner"
            )

            # Calculate days from index to event
            events_with_index["DAYS_TO_EVENT"] = (
                pd.to_datetime(events_with_index["EVENT_DATE"])
                - pd.to_datetime(events_with_index["INDEX_DATE"])
            ).dt.days

            # Filter to events within time point
            events_within_timepoint = events_with_index[
                (events_with_index["DAYS_TO_EVENT"] >= 0)
                & (events_with_index["DAYS_TO_EVENT"] <= time_point)
            ]

            # Mark patients who had events within timepoint
            patients_with_events = set(events_within_timepoint["PERSON_ID"])
            analysis_data["EVENT_WITHIN_TIMEPOINT"] = (
                analysis_data["PERSON_ID"].isin(patients_with_events).astype(int)
            )

            logger.debug(
                f"Outcome {outcome.name} at {time_point} days: {len(patients_with_events)} events"
            )
            return analysis_data

        except Exception as e:
            logger.error(f"Failed to get outcome events for {outcome.name}: {e}")
            return analysis_data.assign(EVENT_WITHIN_TIMEPOINT=0)

    def _analyze_outcome_at_timepoint(
        self, analysis_data: pd.DataFrame, outcome: "Phenotype", time_point: int
    ) -> Optional[dict]:
        """Analyze a single outcome at a specific time point."""
        try:
            # Get events within timepoint
            data_with_events = self._get_outcome_events(
                outcome, analysis_data, time_point
            )

            # Count events and total patients
            n_events = (data_with_events["EVENT_WITHIN_TIMEPOINT"] == 1).sum()
            n_total = len(data_with_events)

            # Check if we have data
            if n_total == 0:
                logger.warning(f"No patients for {outcome.name} at {time_point} days")
                return None

            # Calculate time under risk and incidence rate
            time_under_risk = self._calculate_time_under_risk(
                data_with_events, outcome, time_point
            )

            # Convert to patient-years and calculate incidence rate
            time_years = time_under_risk["total_years"]
            incidence_rate = (n_events / time_years * 100) if time_years > 0 else 0

            return {
                "Outcome": outcome.name,
                "Time_Point_Days": time_point,
                "N_Events": int(n_events),
                "N_Total": int(n_total),
                "Time_Under_Risk": round(time_years, 1),
                "Incidence_Rate": round(incidence_rate, 2),
            }

        except Exception as e:
            logger.error(
                f"Analysis failed for {outcome.name} at {time_point} days: {e}"
            )
            return None

    def _create_pretty_display(self):
        """Create formatted display version of results."""
        if self.df.empty:
            return

        # Round numeric columns
        numeric_columns = [
            "Incidence_Rate",
            "Time_Under_Risk",
        ]
        for col in numeric_columns:
            if col in self.df.columns:
                self.df[col] = self.df[col].round(self.decimal_places)

        # Reorder columns for display
        display_columns = [
            "Outcome",
            "Time_Point_Days",
            "N_Events",
            "N_Total",
            "Time_Under_Risk",
            "Incidence_Rate",
        ]

        # Only include columns that exist
        display_columns = [col for col in display_columns if col in self.df.columns]
        self.df = self.df[display_columns]

    def _calculate_time_under_risk(
        self, data_with_events: pd.DataFrame, outcome: "Phenotype", time_point: int
    ) -> dict:
        """Calculate time under risk in patient-years for the cohort."""
        try:
            # Add censoring information
            data_with_censoring = self._add_censoring_information(
                data_with_events, outcome, time_point
            )

            # Sum follow-up time and convert to years
            total_years = data_with_censoring["FOLLOWUP_DAYS"].sum() / 365.25

            logger.debug(
                f"Time under risk for {outcome.name} at {time_point} days: "
                f"{total_years:.1f} patient-years"
            )

            return {"total_years": round(total_years, 2)}

        except Exception as e:
            logger.warning(
                f"Could not calculate time under risk for {outcome.name}: {e}"
            )
            return {"total_years": 0.0}

    def _add_censoring_information(
        self, analysis_data: pd.DataFrame, outcome: "Phenotype", time_point: int
    ) -> pd.DataFrame:
        """Add censoring information and calculate follow-up time for each patient."""
        data = analysis_data.copy()

        # Initialize follow-up time as the time_point (maximum possible)
        data["FOLLOWUP_DAYS"] = time_point

        # For patients who had the outcome event, follow-up ends at event time
        if "EVENT_WITHIN_TIMEPOINT" in data.columns:
            # Get actual event times for patients who had events
            try:
                outcome_table = outcome.table.select(
                    ["PERSON_ID", "EVENT_DATE", "BOOLEAN"]
                ).distinct()
                outcome_events = outcome_table.to_pandas()
                outcome_events = outcome_events[outcome_events["BOOLEAN"] == True]

                if not outcome_events.empty:
                    # Merge to get event dates
                    events_with_index = outcome_events.merge(
                        data[["PERSON_ID", "INDEX_DATE"]], on="PERSON_ID", how="inner"
                    )

                    # Calculate days to event
                    events_with_index["DAYS_TO_EVENT"] = (
                        pd.to_datetime(events_with_index["EVENT_DATE"])
                        - pd.to_datetime(events_with_index["INDEX_DATE"])
                    ).dt.days

                    # Filter to events within time point
                    valid_events = events_with_index[
                        (events_with_index["DAYS_TO_EVENT"] >= 0)
                        & (events_with_index["DAYS_TO_EVENT"] <= time_point)
                    ]

                    # Update follow-up time for patients with events
                    for _, row in valid_events.iterrows():
                        data.loc[
                            data["PERSON_ID"] == row["PERSON_ID"], "FOLLOWUP_DAYS"
                        ] = row["DAYS_TO_EVENT"]

            except Exception as e:
                logger.warning(
                    f"Could not get exact event times for {outcome.name}: {e}"
                )

        # Apply right censoring phenotypes
        for censor_phenotype in self.right_censor_phenotypes:
            try:
                censor_table = censor_phenotype.table.select(
                    ["PERSON_ID", "EVENT_DATE", "BOOLEAN"]
                ).distinct()
                censor_events = censor_table.to_pandas()
                censor_events = censor_events[censor_events["BOOLEAN"] == True]

                if not censor_events.empty:
                    # Merge to get censoring dates
                    censors_with_index = censor_events.merge(
                        data[["PERSON_ID", "INDEX_DATE"]], on="PERSON_ID", how="inner"
                    )

                    # Calculate days to censoring
                    censors_with_index["DAYS_TO_CENSOR"] = (
                        pd.to_datetime(censors_with_index["EVENT_DATE"])
                        - pd.to_datetime(censors_with_index["INDEX_DATE"])
                    ).dt.days

                    # Update follow-up time if censoring occurs earlier
                    for _, row in censors_with_index.iterrows():
                        if row["DAYS_TO_CENSOR"] >= 0:  # Only future censoring events
                            current_followup = data.loc[
                                data["PERSON_ID"] == row["PERSON_ID"], "FOLLOWUP_DAYS"
                            ].iloc[0]
                            data.loc[
                                data["PERSON_ID"] == row["PERSON_ID"], "FOLLOWUP_DAYS"
                            ] = min(current_followup, row["DAYS_TO_CENSOR"])

            except Exception as e:
                logger.warning(
                    f"Could not apply censoring from {censor_phenotype.name}: {e}"
                )

        # Apply end of study period censoring
        if self.end_of_study_period is not None:
            try:
                end_date = pd.to_datetime(self.end_of_study_period)
                data["DAYS_TO_END_STUDY"] = (
                    end_date - pd.to_datetime(data["INDEX_DATE"])
                ).dt.days

                # Update follow-up time if end of study occurs earlier
                data["FOLLOWUP_DAYS"] = data[
                    ["FOLLOWUP_DAYS", "DAYS_TO_END_STUDY"]
                ].min(axis=1)

            except Exception as e:
                logger.warning(f"Could not apply end of study period censoring: {e}")

        # Ensure follow-up time is non-negative
        data["FOLLOWUP_DAYS"] = data["FOLLOWUP_DAYS"].clip(lower=0)

        return data
