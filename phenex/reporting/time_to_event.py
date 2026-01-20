from typing import Union, Optional, List
import math
import os
import pandas as pd
from lifelines import KaplanMeierFitter
from lifelines.plotting import add_at_risk_counts

import matplotlib.pyplot as plt
import ibis

from phenex.reporting import Reporter
from phenex.filters import ValueFilter
from phenex.util import create_logger

logger = create_logger(__name__)


class TimeToEvent(Reporter):
    """
    Perform a time to event analysis using Kaplan-Meier estimation.

    This reporter generates:
    1. A private patient-level time-to-event table (_tte_table) for intermediate processing
    2. Aggregated survival/risk data in self.df combining results from all outcomes
    3. Kaplan-Meier survival curves

    The patient-level table (_tte_table) contains one row per patient with:
    - Index date for each patient
    - Event dates for all outcomes (NULL if did not occur)
    - Event dates for all right censoring events (NULL if did not occur)
    - End of study period date (if provided)
    - Days from index to each event
    - Indicator variables for whether the first event was the outcome of interest

    The aggregated output (self.df) contains survival function estimates and event counts
    for each outcome, suitable for reporting and visualization.

    Parameters:
        right_censor_phenotypes: A list of phenotypes that should be used as right censoring events.
            Suggested are death and end of followup.
        end_of_study_period: A datetime defining the end of study period.
        decimal_places: Number of decimal places for rounding survival probabilities. Default: 4
        pretty_display: If True, format output for display. Default: True
    """

    def __init__(
        self,
        right_censor_phenotypes: Optional[List["Phenotype"]] = None,
        end_of_study_period: Optional["datetime"] = None,
        decimal_places: int = 4,
        pretty_display: bool = True,
    ):
        super().__init__(decimal_places=decimal_places, pretty_display=pretty_display)
        self.right_censor_phenotypes = right_censor_phenotypes
        self.end_of_study_period = end_of_study_period
        self._date_column_names = None
        self._tte_table = None  # Private: patient-level time-to-event data

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        """
        Execute the time to event analysis for a provided cohort.

        This generates:
        1. Patient-level time-to-event table (stored in self._tte_table)
        2. Aggregated survival/risk data from Kaplan-Meier fits (stored in self.df)
        3. Kaplan-Meier plots

        Parameters:
            cohort: The cohort for which the time to event analysis should be performed.

        Returns:
            DataFrame with aggregated survival function estimates and event counts for all outcomes.

            Schema:
                - Outcome (str): Name of the outcome phenotype
                - Timeline (float): Time point in days from index
                - Survival_Probability (float): Kaplan-Meier survival estimate at this time point
                - At_Risk (int): Number of patients at risk at this time point
                - Events (int): Number of outcome events observed at this time point
                - Censored (int): Number of patients censored at this time point
        """
        self.cohort = cohort
        self._execute_right_censoring_phenotypes(self.cohort)

        # Build patient-level time-to-event table
        table = cohort.index_table.mutate(
            INDEX_DATE=self.cohort.index_table.EVENT_DATE
        ).select(["PERSON_ID", "INDEX_DATE"])
        table = self._append_date_events(table)
        table = self._append_days_to_event(table)
        table = self._append_date_and_days_to_first_event(table)
        self._tte_table = table.execute()  # Convert to pandas DataFrame

        # Build aggregated survival/risk data from KM fits
        self.df = self._build_aggregated_risk_table()

        logger.info("time to event finished execution")
        self.plot_multiple_kaplan_meier()
        return self.df

    def _execute_right_censoring_phenotypes(self, cohort):
        for phenotype in self.right_censor_phenotypes:
            phenotype.execute(cohort.subset_tables_index)

    def _append_date_events(self, table):
        """
        Append a column for all necessary event dates. This includes :
        1. the date of all outcome phenotypes; column name is name of phenotype
        2. the date of all right censor phenotypes; column name is name of phenotype
        3. date of end of study period; column name is END_OF_STUDY_PERIOD
        Additionally, this method populates _date_column_names with the name of all date columns appended here.
        """
        table = self._append_dates_for_phenotypes(table, self.cohort.outcomes)
        table = self._append_dates_for_phenotypes(table, self.right_censor_phenotypes)
        self._date_column_names = [
            x.name.upper() for x in self.cohort.outcomes + self.right_censor_phenotypes
        ]
        if self.end_of_study_period is not None:
            table = table.mutate(
                END_OF_STUDY_PERIOD=ibis.literal(self.end_of_study_period)
            )
            self._date_column_names.append("END_OF_STUDY_PERIOD")
        return table

    def _append_dates_for_phenotypes(self, table, phenotypes):
        """
        Generic method that adds the EVENT_DATE for a list of phenotypes

        For example, if three phenotypes are provided, named pt1, pt2, pt3, three new columns pt1, pt2, pt3 are added each populated with the EVENT_DATE of the respective phenotype.
        """
        for _phenotype in phenotypes:
            logger.info(f"appending dates for { _phenotype.name}")
            join_table = _phenotype.table.select(["PERSON_ID", "EVENT_DATE"]).distinct()
            # rename event_date to the right_censor_phenotype's name
            join_table = join_table.mutate(
                **{_phenotype.name.upper(): join_table.EVENT_DATE}
            )
            # select just person_id and event_date for current phenotype
            join_table = join_table.select(["PERSON_ID", _phenotype.name.upper()])
            # perform the join
            table = table.join(
                join_table, table.PERSON_ID == join_table.PERSON_ID, how="left"
            ).drop("PERSON_ID_right")
        return table

    def _append_days_to_event(self, table):
        """
        Calculates the days to each EVENT_DATE column found in _date_column_names. New columm names are "DAYS_TO_{date column name}".
        """
        for column_name in self._date_column_names:
            logger.info(f"appending time to event for {column_name}")
            DAYS_TO_EVENT = table[column_name].delta(table.INDEX_DATE, "day")
            table = table.mutate(**{f"DAYS_TO_{column_name}": DAYS_TO_EVENT})
        return table

    def _append_date_and_days_to_first_event(self, table):
        """
        For each outcome phenotype, determines which event occurred first, whether the outcome, a right censoring event, or the end of study period. Adds an indicator column whether the first event is the outcome.
        """
        for phenotype in self.cohort.outcomes:
            # Subset the columns from which the minimum date should be determined; this is the outcome of interest, all right censoring events, and end of study period.
            cols = [phenotype.name.upper()] + [
                x.name.upper() for x in self.right_censor_phenotypes
            ]

            # Create a proper minimum date calculation that handles nulls correctly
            # Start with a very large date as the initial minimum
            min_date_expr = ibis.literal(self.end_of_study_period)

            # For each column, update the minimum if the column has a valid (non-null) date that's smaller
            for col in cols:
                min_date_expr = (
                    ibis.case()
                    .when(
                        table[col].notnull() & (table[col] < min_date_expr), table[col]
                    )
                    .else_(min_date_expr)
                    .end()
                )

            min_date_column = min_date_expr

            # Adding the new column to the table
            table = table.mutate(min_date=min_date_column)

            # Adding the new column to the table
            column_name_date_first_event = f"DATE_FIRST_EVENT_{phenotype.name.upper()}"
            table = table.mutate(**{column_name_date_first_event: min_date_column})
            DAYS_FIRST_EVENT = table[column_name_date_first_event].delta(
                table.INDEX_DATE, "day"
            )
            table = table.mutate(
                **{f"DAYS_FIRST_EVENT_{phenotype.name.upper()}": DAYS_FIRST_EVENT}
            )
            # Adding an indicator for whether the first event was the outcome or a censoring event
            table = table.mutate(
                **{
                    f"INDICATOR_{phenotype.name.upper()}": ibis.ifelse(
                        table[phenotype.name.upper()]
                        == table[f"DATE_FIRST_EVENT_{phenotype.name.upper()}"],
                        1,
                        0,
                    )
                }
            )
        return table

    def plot_multiple_kaplan_meier(
        self,
        xlim: Optional[List[int]] = None,
        ylim: Optional[List[int]] = None,
        n_cols: int = 3,
        outcome_indices: Optional[List[int]] = None,
        path_dir: Optional[str] = None,
    ):
        """
        For each outcome, plot a kaplan meier curve.
        """
        # subset for current codelist
        phenotypes = self.cohort.outcomes
        if outcome_indices is not None:
            phenotypes = [
                x for i, x in enumerate(self.cohort.outcomes) if i in outcome_indices
            ]
        n_rows = math.ceil(len(phenotypes) / n_cols)
        fig, axes = plt.subplots(n_rows, n_cols, sharey=True, sharex=True)

        for i, phenotype in enumerate(phenotypes):
            kmf = self.fit_kaplan_meier_for_phenotype(phenotype)
            if n_rows > 1 and n_cols > 1:
                ax = axes[int(i / n_cols), i % n_cols]
            else:
                ax = axes[i]
            ax.set_title(phenotype.name)
            if xlim is not None:
                ax.set_xlim(xlim)
            if ylim is not None:
                ax.set_ylim(ylim)
            kmf.plot(ax=ax)
            ax.grid(color="gray", linestyle="-", linewidth=0.1)

        if path_dir is not None:
            path = os.path.join(path_dir, f"KaplanMeierPanelFor_{self.cohort.name}.svg")
            plt.savefig(path, dpi=150)
        plt.show()

    def plot_single_kaplan_meier(
        self,
        outcome_index: int = 0,
        xlim: Optional[List[int]] = None,
        ylim: Optional[List[int]] = None,
        path_dir: Optional[str] = None,
    ):
        """
        For each outcome, plot a kaplan meier curve.
        """
        # subset for current codelist
        phenotype = self.cohort.outcomes[outcome_index]
        fig, ax = plt.subplots(1, 1)

        kmf = self.fit_kaplan_meier_for_phenotype(phenotype)

        ax.set_title(f"Kaplan Meier for outcome : {phenotype.name}")
        kmf.plot(ax=ax)
        add_at_risk_counts(kmf, ax=ax)
        plt.tight_layout()
        ax.grid(color="gray", linestyle="-", linewidth=0.1)
        if xlim is not None:
            ax.set_xlim(xlim)
        if ylim is not None:
            ax.set_ylim(ylim)

        if path_dir is not None:
            path = os.path.join(
                path_dir, f"KaplanMeier_{self.cohort.name}_{phenotype.name}.svg"
            )
            plt.savefig(path, dpi=150)
        plt.show()

    def fit_kaplan_meier_for_phenotype(self, phenotype):
        """
        Fit a Kaplan-Meier model for a specific phenotype outcome.

        Parameters:
            phenotype: The outcome phenotype to analyze

        Returns:
            KaplanMeierFitter: Fitted KM model
        """
        indicator = f"INDICATOR_{phenotype.name.upper()}"
        durations = f"DAYS_FIRST_EVENT_{phenotype.name.upper()}"
        _sdf = self._tte_table[[indicator, durations]]
        _df = _sdf
        kmf = KaplanMeierFitter(label=phenotype.name)
        kmf.fit(durations=_df[durations], event_observed=_df[indicator])
        return kmf

    def _build_aggregated_risk_table(self) -> pd.DataFrame:
        """
        Build aggregated survival/risk data from Kaplan-Meier fits for all outcomes.

        Combines survival function estimates and event tables from all outcomes into a single
        DataFrame suitable for reporting.

        Returns:
            DataFrame with columns: Outcome, Timeline, Survival_Probability, At_Risk, Events, Censored
        """
        all_outcomes_data = []

        for phenotype in self.cohort.outcomes:
            kmf = self.fit_kaplan_meier_for_phenotype(phenotype)

            # Get survival function
            survival_df = kmf.survival_function_.reset_index()
            survival_df.columns = ["Timeline", "Survival_Probability"]

            # Get event table
            event_df = kmf.event_table.reset_index()
            event_df = event_df.rename(columns={"event_at": "Timeline"})

            # Merge survival and event data
            outcome_df = pd.merge(survival_df, event_df, on="Timeline", how="left")

            # Add outcome name
            outcome_df.insert(0, "Outcome", phenotype.name)

            # Select and rename key columns
            outcome_df = outcome_df[
                [
                    "Outcome",
                    "Timeline",
                    "Survival_Probability",
                    "at_risk",
                    "observed",
                    "censored",
                ]
            ].rename(
                columns={
                    "at_risk": "At_Risk",
                    "observed": "Events",
                    "censored": "Censored",
                }
            )

            all_outcomes_data.append(outcome_df)

        # Combine all outcomes
        if all_outcomes_data:
            result = pd.concat(all_outcomes_data, ignore_index=True)
        else:
            result = pd.DataFrame()

        return result
