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
    - N censored patients (patients whose follow-up was cut short)
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
        right_censor_phenotypes: Optional[List] = None,
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
            - Time_Point: Days from index date
            - N_Events: Number of events in cohort
            - N_Censored: Number of censored patients
            - N_Total: Total patients in cohort
            - Time_Under_Risk: Follow-up time in 100 patient-years
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

        # Analyze each outcome at each time point
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
        # Get cohort index table
        index_table = self.cohort.table

        # Rename EVENT_DATE to INDEX_DATE for clarity
        index_table = index_table.mutate(INDEX_DATE=index_table.EVENT_DATE)
        index_table = index_table.select(["PERSON_ID", "INDEX_DATE"])

        # Get outcome events table
        outcome_events = outcome.table

        # Left join cohort with outcome events to get all patients and their potential events
        index_table = index_table.left_join(
            outcome_events, index_table.PERSON_ID == outcome_events.PERSON_ID
        )

        # Calculate days from index to event (null if no event)
        index_table = index_table.mutate(
            DAYS_TO_EVENT=ibis.case()
            .when(index_table.EVENT_DATE.isnull(), ibis.null())
            .else_(
                (
                    index_table.EVENT_DATE.cast("date")
                    - index_table.INDEX_DATE.cast("date")
                ).cast("int")
            )
            .end()
        )

        # Caclulate censoring time
        index_table = self._apply_censoring(index_table, time_point)

        # Filter to valid events within time window (after censoring)
        # FIXME need to be careful about ties!
        index_table = index_table.mutate(
            HAS_EVENT_IN_WINDOW=ibis.case()
            .when(
                (index_table.DAYS_TO_EVENT.notnull())
                & (index_table.DAYS_TO_EVENT >= 0)
                & (index_table.DAYS_TO_EVENT <= time_point)
                & (index_table.DAYS_TO_EVENT <= index_table.CENSOR_TIME),
                1,
            )
            .else_(0)
            .end()
        )

        # Calculate actual event time (min of event time and censor time)
        index_table = index_table.mutate(
            ACTUAL_EVENT_TIME=ibis.case()
            .when(
                index_table.HAS_EVENT_IN_WINDOW == 1,
                index_table.DAYS_TO_EVENT,
            )
            .else_(ibis.null())
            .end(),
            FOLLOWUP_TIME=ibis.least(
                ibis.case()
                .when(
                    index_table.DAYS_TO_EVENT.notnull(),
                    index_table.DAYS_TO_EVENT,
                )
                .else_(time_point)
                .end(),
                index_table.CENSOR_TIME,
                time_point,
            ),
            # Mark patients as censored if their follow-up was cut short by censoring
            # (i.e., censor time is less than time_point and they didn't have an event)
            IS_CENSORED=ibis.case()
            .when(
                (index_table.HAS_EVENT_IN_WINDOW == 0)
                & (index_table.CENSOR_TIME < time_point),
                1,
            )
            .else_(0)
            .end(),
        )

        # Aggregate to get summary statistics
        summary = index_table.aggregate(
            [
                _.HAS_EVENT_IN_WINDOW.sum().name("N_Events"),
                _.IS_CENSORED.sum().name("N_Censored"),
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
        n_censored = int(row["N_Censored"])
        total_followup_days = float(row["Total_Followup_Days"])

        # Convert to patient-years and calculate incidence rate
        time_years = total_followup_days / 365.25
        incidence_rate = (n_events / time_years * 100) if time_years > 0 else 0

        logger.debug(
            f"Outcome {outcome.name} at {time_point} days: {n_events} events, {n_censored} censored. "
        )

        return {
            "Outcome": outcome.name,
            "Time_Point": time_point,
            "N_Events": n_events,
            "N_Censored": n_censored,
            "Time_Under_Risk": round(time_years, 1),
            "Incidence_Rate": round(incidence_rate, 2),
        }

    def _apply_censoring(self, index_table, time_point: int):
        """Apply censoring from right-censoring phenotypes using Ibis operations."""
        # Start with no censoring (full follow-up time)
        index_table = index_table.mutate(CENSOR_TIME=time_point)

        # Apply each right-censoring phenotype
        for censor_phenotype in self.right_censor_phenotypes:
            # Get censoring events
            censor_events = (
                censor_phenotype.table.filter(censor_phenotype.table.BOOLEAN == True)
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
            index_table = index_table.left_join(
                censor_events_renamed,
                index_table.PERSON_ID == censor_events_renamed.CENSOR_PERSON_ID,
            )

            # Calculate days to censoring event
            index_table = index_table.mutate(
                DAYS_TO_CENSOR=ibis.case()
                .when(index_table.CENSOR_EVENT_DATE.isnull(), ibis.null())
                .else_(
                    (
                        index_table.CENSOR_EVENT_DATE.cast("date")
                        - index_table.INDEX_DATE.cast("date")
                    ).cast("int")
                )
                .end()
            )

            # Update censoring time to be minimum of current censor time and this censoring event
            index_table = index_table.mutate(
                CENSOR_TIME=ibis.case()
                .when(
                    (index_table.DAYS_TO_CENSOR.notnull())
                    & (index_table.DAYS_TO_CENSOR >= 0)
                    & (index_table.DAYS_TO_CENSOR < index_table.CENSOR_TIME),
                    index_table.DAYS_TO_CENSOR,
                )
                .else_(index_table.CENSOR_TIME)
                .end()
            )

            # Clean up temporary columns
            index_table = index_table.drop(
                ["CENSOR_PERSON_ID", "CENSOR_EVENT_DATE", "DAYS_TO_CENSOR"]
            )

        # Apply end of study period censoring if specified
        if self.end_of_study_period is not None:
            # Calculate days from index to end of study
            end_date = ibis.literal(pd.to_datetime(self.end_of_study_period).date())
            index_table = index_table.mutate(
                DAYS_TO_END_STUDY=(end_date - index_table.INDEX_DATE.cast("date")).cast(
                    "int"
                )
            )

            # Update censoring time
            index_table = index_table.mutate(
                CENSOR_TIME=ibis.least(
                    index_table.CENSOR_TIME, index_table.DAYS_TO_END_STUDY
                )
            )

            # Clean up
            index_table = index_table.drop(["DAYS_TO_END_STUDY"])

        return index_table

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
            "Time_Point",
            "N_Events",
            "N_Censored",
            "N_Total",
            "Time_Under_Risk",
            "Incidence_Rate",
        ]

        # Only include columns that exist
        display_columns = [col for col in display_columns if col in self.df.columns]
        self.df = self.df[display_columns]
