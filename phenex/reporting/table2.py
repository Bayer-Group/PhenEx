import pandas as pd
import ibis
from ibis import _
from typing import List, Optional
from datetime import datetime

from phenex.phenotypes import Phenotype
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
        from datetime import datetime

        # Simple analysis without censoring
        table2 = Table2(
            time_points=[90, 365, 730],  # 3 months, 1 year, 2 years
        )

        # Analysis with right censoring
        table2_censored = Table2(
            time_points=[90, 365, 730],
            right_censor_phenotypes=[death_phenotype],
            end_of_study_period=datetime(2023, 12, 31)
        )
        results = table2_censored.execute(cohort)  # Uses cohort.outcomes
        ```
    """

    def __init__(
        self,
        time_points: List[int] = [365],  # Default to 1 year
        decimal_places: int = 3,
        pretty_display: bool = True,
        right_censor_phenotypes: Optional[List[Phenotype]] = None,
        end_of_study_period: Optional["datetime"] = None,
    ):
        super().__init__(decimal_places=decimal_places, pretty_display=pretty_display)
        self.time_points = sorted(time_points)  # Sort time points
        self.right_censor_phenotypes = right_censor_phenotypes or []
        self.end_of_study_period = end_of_study_period

    def execute(self, cohort) -> pd.DataFrame:
        """
        Execute Table2 analysis for the provided cohort.

        Expected input columns:
        - cohort.table: PERSON_ID, EVENT_DATE (index date)
        - cohort.outcomes[].table: PERSON_ID, EVENT_DATE (outcome event date)
        - right_censor_phenotypes[].table: PERSON_ID, EVENT_DATE, BOOLEAN (if censoring used)

        Args:
            cohort: The cohort containing outcomes and index table

        Returns:
            DataFrame with columns:
            - Outcome: Name of outcome variable
            - Time_Point: Days from index date
            - N_Events: Number of events in cohort
            - N_Censored: Number of censored patients
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
                result = self._calculate_time_under_risk_for_outcome_at_timepoint(
                    outcome, time_point
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

    def _calculate_time_under_risk_for_outcome_at_timepoint(
        self, outcome: Phenotype, time_point: int
    ) -> Optional[dict]:
        """
        Calculate the total time under risk for single outcome at a specific time point.

        Expected input columns:
        - cohort.table: PERSON_ID, EVENT_DATE (index date)
        - outcome.table: PERSON_ID, EVENT_DATE (outcome event date)

        Columns added during processing:
        - INDEX_DATE: Renamed from EVENT_DATE for clarity
        - DAYS_TO_EVENT: Days from index to outcome event (null if no event)
        - CENSOR_TIME: Time point when follow-up is censored
        - HAS_EVENT_IN_WINDOW: 1 if valid event within time window, 0 otherwise
        - FOLLOWUP_TIME: Actual follow-up time accounting for censoring
        - IS_CENSORED: 1 if patient was censored before time_point, 0 otherwise

        Args:
            outcome: Phenotype outcome to analyze
            time_point: Number of days from index to analyze

        Returns:
            Dictionary with analysis results or None if no data
        """
        # Get cohort index table
        index_table = self.cohort.table

        # Rename EVENT_DATE to INDEX_DATE for clarity
        index_table = index_table.mutate(INDEX_DATE=index_table.EVENT_DATE)
        index_table = index_table.select(["PERSON_ID", "INDEX_DATE"])

        # Calculate time to first outcome event
        index_table = self._calculate_time_to_first_post_index_event(
            index_table, [outcome], "OUTCOME_DATE", "DAYS_TO_EVENT"
        )

        # Calculate censoring time from right-censoring phenotypes
        index_table = self._calculate_time_to_first_post_index_event(
            index_table, self.right_censor_phenotypes, "CENSOR_DATE", "DAYS_TO_CENSOR"
        )

        # Apply end_of_study_period censoring if specified
        if self.end_of_study_period is not None:
            # Convert datetime to date if needed
            if hasattr(self.end_of_study_period, "date"):
                end_date = ibis.literal(self.end_of_study_period.date())
            else:
                # Fallback for string dates
                end_date = ibis.literal(pd.to_datetime(self.end_of_study_period).date())

            index_table = index_table.mutate(
                DAYS_TO_END_STUDY=(end_date - index_table.INDEX_DATE.cast("date")).cast(
                    "int"
                )
            )

            # Final censoring time is minimum of phenotype censoring and end of study
            index_table = index_table.mutate(
                CENSOR_TIME=ibis.case()
                .when(
                    index_table.DAYS_TO_CENSOR.isnull(), index_table.DAYS_TO_END_STUDY
                )
                .else_(
                    ibis.least(
                        index_table.DAYS_TO_CENSOR, index_table.DAYS_TO_END_STUDY
                    )
                )
                .end()
            ).drop("DAYS_TO_END_STUDY")
        else:
            # No end of study period, use phenotype censoring
            index_table = index_table.mutate(
                CENSOR_TIME=ibis.coalesce(index_table.DAYS_TO_CENSOR, time_point)
            )

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

        # Calculate followup time (min of event time and censor time)
        index_table = index_table.mutate(
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

    def _calculate_time_to_first_post_index_event(
        self, index_table, phenotypes, date_column_name: str, days_column_name: str
    ):
        """
        Calculate time to first event (outcome or censoring) for each person_id, index_date combination in the cohort.

        Input columns:
        - index_table: patient_id, index_date
        - phenotypes: List of phenotypes with event_date columns

        Output columns added:
        - date_column_name: Date of first event or None
        - days_column_name: Days from index to event or None if no event
        """
        # Validate row count before processing
        initial_row_count = index_table.count().execute()

        # If no phenotypes specified, everyone has no events
        if not phenotypes:
            result = index_table.mutate(
                **{date_column_name: None, days_column_name: None}
            )
            final_row_count = result.count().execute()
            if initial_row_count != final_row_count:
                raise ValueError(
                    f"Row count changed during processing: {initial_row_count} -> {final_row_count}"
                )
            return result

        # Collect all phenotype dates
        event_dates = []
        for phenotype in phenotypes:
            # Get the PERSON_ID and date columns from this phenotype
            # Handle both real phenotypes (where table is a method) and mock phenotypes (where table is an attribute)
            phenotype_table = phenotype.table.select(["PERSON_ID", "EVENT_DATE"])
            phenotype_table = phenotype_table.rename({"phenotype_date": "EVENT_DATE"})
            event_dates.append(phenotype_table)

        # Union all event dates
        if len(event_dates) == 1:
            all_event_dates = event_dates[0]
        else:
            all_event_dates = event_dates[0]
            for table in event_dates[1:]:
                all_event_dates = all_event_dates.union(table)

        # Join with index table and filter to events >= index_date
        with_events = index_table.join(all_event_dates, "PERSON_ID", how="left")

        # Get all existing columns except the ones we're about to join
        existing_columns = [col for col in index_table.columns]
        group_by_columns = (
            existing_columns  # Group by all existing columns to preserve them
        )

        # Group by patient and get the first (minimum) event date >= index_date
        # Use case expression to only consider valid events in the min aggregation
        first_event = with_events.group_by(group_by_columns).aggregate(
            first_event_date=ibis.case()
            .when(
                with_events.phenotype_date.isnull()
                | (with_events.phenotype_date < with_events.INDEX_DATE),
                None,
            )
            .else_(with_events.phenotype_date)
            .end()
            .min()
        )

        # Calculate days between index and first event
        result = first_event.mutate(
            **{
                date_column_name: first_event.first_event_date,
                days_column_name: ibis.case()
                .when(first_event.first_event_date.isnull(), None)
                .else_(
                    (first_event.first_event_date - first_event.INDEX_DATE).cast(int)
                )
                .end(),
            }
        ).drop("first_event_date")

        # Validate row count after processing
        final_row_count = result.count().execute()
        if initial_row_count != final_row_count:
            raise ValueError(
                f"Row count changed during processing: {initial_row_count} -> {final_row_count}"
            )

        return result

    def _create_pretty_display(self):
        """
        Create formatted display version of results.

        Expected input columns (from self.df):
        - Outcome: Name of outcome variable
        - Time_Point: Days from index date
        - N_Events: Number of events in cohort
        - N_Censored: Number of censored patients
        - Time_Under_Risk: Follow-up time in 100 patient-years
        - Incidence_Rate: Incidence rate per 100 patient-years

        Columns modified:
        - Incidence_Rate: Rounded to specified decimal places
        - Time_Under_Risk: Rounded to specified decimal places

        Final column order:
        - Outcome, Time_Point, N_Events, N_Censored, N_Total, Time_Under_Risk, Incidence_Rate
        """
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
