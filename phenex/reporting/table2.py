import pandas as pd
import numpy as np
from typing import List, Optional, TYPE_CHECKING

from phenex.reporting.reporter import Reporter
from phenex.util import create_logger

if TYPE_CHECKING:
    from phenex.phenotypes.phenotype import Phenotype
    from phenex.phenotypes.cohort import Cohort

logger = create_logger(__name__)


class Table2(Reporter):
    """
    Table2 generates a simple epidemiological association table showing unadjusted odds ratios
    and incidence rates for each outcome at specified time points.

    For each outcome, reports:
    - N events in exposed vs unexposed groups
    - Time under risk in 100 patient-years for exposed and unexposed groups (accounting for censoring)
    - Incidence rate per 100 patient-years for exposed and unexposed groups
    - Unadjusted odds ratio (exposed vs unexposed)
    - Confidence interval for odds ratio
    - P-value

    Time under risk accounts for censoring from competing events (e.g., death) and
    administrative censoring at end of study period.

    Parameters:
        exposure: Single exposure phenotype (binary: exposed vs unexposed)
        time_points: List of days from index to evaluate outcomes (e.g., [90, 365])
        confidence_level: Confidence level for intervals (default: 0.95 for 95% CI)
        right_censor_phenotypes: List of phenotypes for right censoring (e.g., death)
        end_of_study_period: End date of study period for administrative censoring

    Note:
        Outcomes are automatically derived from cohort.outcomes (like Table1)

    Example:
        ```python
        # Simple analysis without censoring
        table2 = Table2(
            exposure=statin_use,
            time_points=[90, 365, 730],  # 3 months, 1 year, 2 years
            confidence_level=0.95
        )

        # Analysis with right censoring
        table2_censored = Table2(
            exposure=statin_use,
            time_points=[90, 365, 730],
            confidence_level=0.95,
            right_censor_phenotypes=[death_phenotype],
            end_of_study_period="2023-12-31"
        )
        results = table2_censored.execute(cohort)  # Uses cohort.outcomes
        ```
    """

    def __init__(
        self,
        exposure: "Phenotype",
        time_points: List[int] = [365],  # Default to 1 year
        confidence_level: float = 0.95,
        decimal_places: int = 3,
        pretty_display: bool = True,
        right_censor_phenotypes: Optional[List["Phenotype"]] = None,
        end_of_study_period: Optional[str] = None,
    ):
        super().__init__(decimal_places=decimal_places, pretty_display=pretty_display)
        self.exposure = exposure
        self.time_points = sorted(time_points)  # Sort time points
        self.confidence_level = confidence_level
        self.right_censor_phenotypes = right_censor_phenotypes or []
        self.end_of_study_period = end_of_study_period

        # Check for scipy for statistical calculations
        try:
            import scipy.stats as stats

            self.stats = stats
            self.has_scipy = True
        except ImportError:
            logger.warning(
                "scipy not available. P-values will not be calculated. Install with: pip install scipy"
            )
            self.stats = None
            self.has_scipy = False

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        """
        Execute Table2 analysis for the provided cohort.

        Args:
            cohort: The cohort containing outcomes and exposure

        Returns:
            DataFrame with columns:
            - Outcome: Name of outcome variable
            - Time_Point_Days: Days from index date
            - N_Exposed_Events: Events in exposed group
            - N_Exposed_Total: Total exposed patients
            - N_Unexposed_Events: Events in unexposed group
            - N_Unexposed_Total: Total unexposed patients
            - Exposed_Time_Under_Risk: Follow-up time in patient-years (exposed group)
            - Unexposed_Time_Under_Risk: Follow-up time in patient-years (unexposed group)
            - Exposed_Incidence_Rate: Incidence rate per 100 patient-years (exposed)
            - Unexposed_Incidence_Rate: Incidence rate per 100 patient-years (unexposed)
            - Odds_Ratio: Unadjusted odds ratio
            - CI_Lower: Lower confidence bound
            - CI_Upper: Upper confidence bound
            - P_Value: Fisher's exact test p-value (if scipy available)
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

        # Get exposure data
        exposure_data = self._get_exposure_data()
        if exposure_data.empty:
            logger.error("No exposure data available")
            return pd.DataFrame()

        # Merge index and exposure
        analysis_data = index_data.merge(exposure_data, on="PERSON_ID", how="inner")
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

    def _get_exposure_data(self) -> pd.DataFrame:
        """Get exposure status for each patient."""
        try:
            exposure_table = self.exposure.table.select(
                ["PERSON_ID", "BOOLEAN"]
            ).distinct()
            exposure_data = exposure_table.to_pandas()

            # Convert boolean exposure to 0/1
            exposure_data["EXPOSED"] = (
                exposure_data["BOOLEAN"].fillna(False).astype(int)
            )
            exposure_data = exposure_data[["PERSON_ID", "EXPOSED"]]

            logger.debug(
                f"Exposure data: {len(exposure_data)} patients, {exposure_data['EXPOSED'].sum()} exposed"
            )
            return exposure_data
        except Exception as e:
            logger.error(f"Failed to get exposure data: {e}")
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

            # Create 2x2 table: Exposure (rows) vs Outcome (columns)
            exposed_events = (
                (data_with_events["EXPOSED"] == 1)
                & (data_with_events["EVENT_WITHIN_TIMEPOINT"] == 1)
            ).sum()
            exposed_total = (data_with_events["EXPOSED"] == 1).sum()
            unexposed_events = (
                (data_with_events["EXPOSED"] == 0)
                & (data_with_events["EVENT_WITHIN_TIMEPOINT"] == 1)
            ).sum()
            unexposed_total = (data_with_events["EXPOSED"] == 0).sum()

            # Check if we have enough data
            if exposed_total == 0 or unexposed_total == 0:
                logger.warning(
                    f"No exposed or unexposed patients for {outcome.name} at {time_point} days"
                )
                return None

            # Calculate risks
            risk_exposed = exposed_events / exposed_total if exposed_total > 0 else 0
            risk_unexposed = (
                unexposed_events / unexposed_total if unexposed_total > 0 else 0
            )

            # Calculate odds ratio with continuity correction for zero cells
            a, b = exposed_events, exposed_total - exposed_events
            c, d = unexposed_events, unexposed_total - unexposed_events

            # Add 0.5 to all cells if any are zero (Haldane correction)
            if a == 0 or b == 0 or c == 0 or d == 0:
                a, b, c, d = a + 0.5, b + 0.5, c + 0.5, d + 0.5

            odds_ratio = (a * d) / (b * c)

            # Calculate confidence interval
            log_or = np.log(odds_ratio)
            se_log_or = np.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
            z_score = (
                self.stats.norm.ppf((1 + self.confidence_level) / 2)
                if self.has_scipy
                else 1.96
            )

            ci_lower = np.exp(log_or - z_score * se_log_or)
            ci_upper = np.exp(log_or + z_score * se_log_or)

            # Calculate p-value using Fisher's exact test
            p_value = None
            if self.has_scipy:
                # Use original counts (without continuity correction) for p-value
                original_a = exposed_events
                original_b = exposed_total - exposed_events
                original_c = unexposed_events
                original_d = unexposed_total - unexposed_events

                contingency_table = [[original_a, original_b], [original_c, original_d]]
                try:
                    _, p_value = self.stats.fisher_exact(
                        contingency_table, alternative="two-sided"
                    )
                except:
                    p_value = None

            # Calculate time under risk and incidence rates
            time_under_risk = self._calculate_time_under_risk(
                data_with_events, outcome, time_point
            )

            # Convert to 100 patient-years and calculate incidence rates
            exposed_time_years = time_under_risk["exposed_years"]
            unexposed_time_years = time_under_risk["unexposed_years"]

            exposed_incidence_rate = (
                (exposed_events / exposed_time_years * 100)
                if exposed_time_years > 0
                else 0
            )
            unexposed_incidence_rate = (
                (unexposed_events / unexposed_time_years * 100)
                if unexposed_time_years > 0
                else 0
            )

            return {
                "Outcome": outcome.name,
                "Time_Point_Days": time_point,
                "N_Exposed_Events": int(exposed_events),
                "N_Exposed_Total": int(exposed_total),
                "N_Unexposed_Events": int(unexposed_events),
                "N_Unexposed_Total": int(unexposed_total),
                "Exposed_Time_Under_Risk": round(exposed_time_years, 1),
                "Unexposed_Time_Under_Risk": round(unexposed_time_years, 1),
                "Exposed_Incidence_Rate": round(exposed_incidence_rate, 2),
                "Unexposed_Incidence_Rate": round(unexposed_incidence_rate, 2),
                "Odds_Ratio": odds_ratio,
                "CI_Lower": ci_lower,
                "CI_Upper": ci_upper,
                "P_Value": p_value,
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
            "Risk_Exposed",
            "Risk_Unexposed",
            "Odds_Ratio",
            "CI_Lower",
            "CI_Upper",
        ]
        for col in numeric_columns:
            if col in self.df.columns:
                self.df[col] = self.df[col].round(self.decimal_places)

        # Format p-values
        if "P_Value" in self.df.columns:
            self.df["P_Value"] = self.df["P_Value"].apply(self._format_p_value)

        # Create confidence interval string
        if all(col in self.df.columns for col in ["CI_Lower", "CI_Upper"]):
            confidence_pct = int(self.confidence_level * 100)
            self.df[f"{confidence_pct}% CI"] = (
                self.df["CI_Lower"].astype(str)
                + " - "
                + self.df["CI_Upper"].astype(str)
            )

        # Reorder columns for display
        display_columns = [
            "Outcome",
            "Time_Point_Days",
            "N_Exposed_Events",
            "N_Unexposed_Events",
            "Exposed_Time_Under_Risk",
            "Unexposed_Time_Under_Risk",
            "Exposed_Incidence_Rate",
            "Unexposed_Incidence_Rate",
            "Odds_Ratio",
            f"{int(self.confidence_level * 100)}% CI",
            "P_Value",
        ]

        # Only include columns that exist
        display_columns = [col for col in display_columns if col in self.df.columns]
        self.df = self.df[display_columns]

    def _calculate_time_under_risk(
        self, data_with_events: pd.DataFrame, outcome: "Phenotype", time_point: int
    ) -> dict:
        """Calculate time under risk in patient-years for exposed and unexposed groups."""
        try:
            # Add censoring information
            data_with_censoring = self._add_censoring_information(
                data_with_events, outcome, time_point
            )

            # Calculate follow-up time for each patient
            exposed_df = data_with_censoring[data_with_censoring["EXPOSED"] == 1]
            unexposed_df = data_with_censoring[data_with_censoring["EXPOSED"] == 0]

            # Sum follow-up time and convert to years
            exposed_years = exposed_df["FOLLOWUP_DAYS"].sum() / 365.25
            unexposed_years = unexposed_df["FOLLOWUP_DAYS"].sum() / 365.25

            logger.debug(
                f"Time under risk for {outcome.name} at {time_point} days: "
                f"{exposed_years:.1f} exposed years, {unexposed_years:.1f} unexposed years"
            )

            return {
                "exposed_years": round(exposed_years, 2),
                "unexposed_years": round(unexposed_years, 2),
            }

        except Exception as e:
            logger.warning(
                f"Could not calculate time under risk for {outcome.name}: {e}"
            )
            return {"exposed_years": 0.0, "unexposed_years": 0.0}

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

    def _format_p_value(self, p_val) -> str:
        """Format p-value for display."""
        if pd.isna(p_val):
            return ""
        elif p_val < 0.001:
            return "<0.001"
        elif p_val < 0.01:
            return f"{p_val:.3f}"
        else:
            return f"{p_val:.3f}"
