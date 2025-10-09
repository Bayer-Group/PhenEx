import pandas as pd
import ibis
from ibis import _
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

    def execute(self, cohort) -> pd.DataFrame:
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

        # Execute right censoring phenotypes if they exist
        for phenotype in self.right_censor_phenotypes:
            phenotype.execute(cohort.subset_tables_index)

        # Analyze each outcome at each time point using pure Ibis
        results_list = []
        for outcome in self.outcomes:
            for time_point in self.time_points:
                result = self._analyze_outcome_at_timepoint(outcome, time_point)
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

    def _analyze_outcome_at_timepoint(self, outcome, time_point: int) -> Optional[dict]:
        """Analyze a single outcome at a specific time point using pure Ibis."""
        try:
            # Get cohort index table
            cohort_index = self.cohort.index_table

            # # Rename EVENT_DATE to INDEX_DATE for clarity
            cohort_index = cohort_index.mutate(INDEX_DATE=cohort_index.EVENT_DATE)
            cohort_index = cohort_index.select(["PERSON_ID", "INDEX_DATE"])

            # Get outcome events table
            outcome_events = outcome.table

            # Left join cohort with outcome events to get all patients and their potential events
            analysis_table = cohort_index.left_join(
                outcome_events, cohort_index.PERSON_ID == outcome_events.PERSON_ID
            )

            # Calculate days from index to event (null if no event)
            analysis_table = analysis_table.mutate(
                DAYS_TO_EVENT=ibis.case()
                .when(analysis_table.EVENT_DATE.isnull(), ibis.null())
                .else_(
                    (
                        analysis_table.EVENT_DATE.cast("date")
                        - analysis_table.INDEX_DATE.cast("date")
                    ).cast("int")
                )
                .end()
            )

            # Apply censoring from right-censoring phenotypes
            analysis_table = self._apply_censoring(analysis_table, time_point)

            # Filter to valid events within time window (after censoring)
            analysis_table = analysis_table.mutate(
                HAS_EVENT_IN_WINDOW=ibis.case()
                .when(
                    (analysis_table.DAYS_TO_EVENT.notnull())
                    & (analysis_table.DAYS_TO_EVENT >= 0)
                    & (analysis_table.DAYS_TO_EVENT <= time_point)
                    & (analysis_table.DAYS_TO_EVENT <= analysis_table.CENSOR_TIME),
                    1,
                )
                .else_(0)
                .end()
            )

            # Calculate actual event time (min of event time and censor time)
            analysis_table = analysis_table.mutate(
                ACTUAL_EVENT_TIME=ibis.case()
                .when(
                    analysis_table.HAS_EVENT_IN_WINDOW == 1,
                    analysis_table.DAYS_TO_EVENT,
                )
                .else_(ibis.null())
                .end(),
                FOLLOWUP_TIME=ibis.least(
                    ibis.case()
                    .when(
                        analysis_table.DAYS_TO_EVENT.notnull(),
                        analysis_table.DAYS_TO_EVENT,
                    )
                    .else_(time_point)
                    .end(),
                    analysis_table.CENSOR_TIME,
                    time_point,
                ),
            )

            # Aggregate to get summary statistics
            summary = analysis_table.aggregate(
                [
                    _.HAS_EVENT_IN_WINDOW.sum().name("N_Events"),
                    _.PERSON_ID.count().name("N_Total"),
                    _.FOLLOWUP_TIME.sum().name("Total_Followup_Days"),
                ]
            )

            # Convert to pandas only at the very end for final calculations
            summary_df = summary.execute()

            if len(summary_df) == 0:
                logger.warning(f"No data for {outcome.name} at {time_point} days")
                return None

            row = summary_df.iloc[0]
            n_events = int(row["N_Events"])
            n_total = int(row["N_Total"])
            total_followup_days = float(row["Total_Followup_Days"])

            # Convert to patient-years and calculate incidence rate
            time_years = total_followup_days / 365.25
            incidence_rate = (n_events / time_years * 100) if time_years > 0 else 0

            logger.debug(
                f"Outcome {outcome.name} at {time_point} days: {n_events} events, "
                f"{n_total} patients, {time_years:.2f} patient-years"
            )

            return {
                "Outcome": outcome.name,
                "Time_Point_Days": time_point,
                "N_Events": n_events,
                "N_Total": n_total,
                "Time_Under_Risk": round(time_years, 1),
                "Incidence_Rate": round(incidence_rate, 2),
            }

        except Exception as e:
            logger.error(
                f"Analysis failed for {outcome.name} at {time_point} days: {e}"
            )
            return None

    def _apply_censoring(self, analysis_table, time_point: int):
        """Apply censoring from right-censoring phenotypes using Ibis operations."""
        # Start with no censoring (full follow-up time)
        analysis_table = analysis_table.mutate(CENSOR_TIME=time_point)

        # Apply each right-censoring phenotype
        for censor_phenotype in self.right_censor_phenotypes:
            try:
                # Get censoring events
                censor_events = (
                    censor_phenotype.table.filter(
                        censor_phenotype.table.BOOLEAN == True
                    )
                    .select(["PERSON_ID", "EVENT_DATE"])
                    .distinct()
                )

                # Rename columns to avoid conflicts
                censor_events_renamed = censor_events.select(
                    [
                        censor_events.PERSON_ID.name("CENSOR_PERSON_ID"),
                        censor_events.EVENT_DATE.name("CENSOR_EVENT_DATE"),
                    ]
                )

                # Left join with analysis table to get censoring dates
                analysis_table = analysis_table.left_join(
                    censor_events_renamed,
                    analysis_table.PERSON_ID == censor_events_renamed.CENSOR_PERSON_ID,
                )

                # Calculate days to censoring event
                analysis_table = analysis_table.mutate(
                    DAYS_TO_CENSOR=ibis.case()
                    .when(analysis_table.CENSOR_EVENT_DATE.isnull(), ibis.null())
                    .else_(
                        (
                            analysis_table.CENSOR_EVENT_DATE.cast("date")
                            - analysis_table.INDEX_DATE.cast("date")
                        ).cast("int")
                    )
                    .end()
                )

                # Update censoring time to be minimum of current censor time and this censoring event
                analysis_table = analysis_table.mutate(
                    CENSOR_TIME=ibis.case()
                    .when(
                        (analysis_table.DAYS_TO_CENSOR.notnull())
                        & (analysis_table.DAYS_TO_CENSOR >= 0)
                        & (analysis_table.DAYS_TO_CENSOR < analysis_table.CENSOR_TIME),
                        analysis_table.DAYS_TO_CENSOR,
                    )
                    .else_(analysis_table.CENSOR_TIME)
                    .end()
                )

                # Clean up temporary columns
                analysis_table = analysis_table.drop(
                    ["CENSOR_PERSON_ID", "CENSOR_EVENT_DATE", "DAYS_TO_CENSOR"]
                )

            except Exception as e:
                logger.warning(
                    f"Could not apply censoring from {censor_phenotype.name}: {e}"
                )

        # Apply end of study period censoring if specified
        if self.end_of_study_period is not None:
            try:
                # Calculate days from index to end of study
                end_date = ibis.literal(pd.to_datetime(self.end_of_study_period).date())
                analysis_table = analysis_table.mutate(
                    DAYS_TO_END_STUDY=(
                        end_date - analysis_table.INDEX_DATE.cast("date")
                    ).cast("int")
                )

                # Update censoring time
                analysis_table = analysis_table.mutate(
                    CENSOR_TIME=ibis.least(
                        analysis_table.CENSOR_TIME, analysis_table.DAYS_TO_END_STUDY
                    )
                )

                # Clean up
                analysis_table = analysis_table.drop(["DAYS_TO_END_STUDY"])

            except Exception as e:
                logger.warning(f"Could not apply end of study period censoring: {e}")

        return analysis_table

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
