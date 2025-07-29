from typing import Union, Optional, List
import math
import os
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
    Perform a time to event analysis.

    The time_to_event table is first generated, after which, by default, a Kaplan Meier plot is generated. The time_to_event table contains one row per patient and then multiple columns containing

    ### Dates
    1. the index date for each patient
    2. the dates of all outcomes or NULL if they did not occur
    3. the dates of all right censoring events or NULL if they did not occur
    4. the date of the end of the study, if provided
    5. the days from index to the dates provided above
    6. the

    | Column | Description |
    | --- | --- |
    | `date` columns | The EVENT_DATE of every 1. cohort outcome phenotype and 2. the right censoring phenotypes, if provided. The column name for the respective EVENT_DATE is the name of the phenotype. 3. Additionally, the date of the end of study period is present, if provided. |
    | `days_to_event` columns | For each `date` column, the number of days from index_date to the `date` column. These columns begin with “DAYS_TO_” and the name of the `date` column. |
    | `date_first_event` columns | For each outcome phenotype, the `date_first_event` column is added titled “DATE_FIRST_EVENT_{name of outcome phenotype}”. This is the first date that occurs post index, whether that outcome, a right censoring event, or the end of study period. |
    | `days_to_first_event` columns | For each outcome phenotype, the `days_to_first_event` column is added titled “DAYS_FIRST_EVENT_{name of outcome phenotype}”. This is the days from index_date to the `date_first_event` column. |
    | `indicator` columns | For each outcome phenotype, the `indicator` column is added titled “INDICATOR_{name of outcome phenotype}”. This has a value of 1 if the first event was the outcome phenotype, or a 0 if the first event was a right censoring event or the end of study period. |

    Parameters:
        right_censor_phenotypes: A list of phenotypes that should be used as right censoring events. Suggested are death and end of followup.
        end_of_study_period: A datetime defining the end of study period.
    """

    def __init__(
        self,
        right_censor_phenotypes: Optional[List["Phenotype"]] = None,
        end_of_study_period: Optional["datetime"] = None,
    ):
        self.right_censor_phenotypes = right_censor_phenotypes
        self.end_of_study_period = end_of_study_period
        self._date_column_names = None

    def execute(self, cohort: "Cohort"):
        """
        Execute the time to event analysis for a provided cohort. This will generate a table with all necessary cohort outcome event dates and right censoring event dates. Following execution, a Kaplan Meier curve will be generated.

        Parameters:
            cohort: The cohort for which the time to event analysis should be performed.
        """
        self.cohort = cohort
        self._execute_right_censoring_phenotypes(self.cohort)

        table = cohort.index_table.mutate(
            INDEX_DATE=self.cohort.index_table.EVENT_DATE
        ).select(["PERSON_ID", "INDEX_DATE"])
        table = self._append_date_events(table)
        table = self._append_days_to_event(table)
        table = self._append_date_and_days_to_first_event(table)
        self.table = table
        logger.info("time to event finished execution")
        self.plot_multiple_kaplan_meier()

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
        indicator = f"INDICATOR_{phenotype.name.upper()}"
        durations = f"DAYS_FIRST_EVENT_{phenotype.name.upper()}"
        _sdf = self.table.select([indicator, durations])
        _df = _sdf.to_pandas()
        kmf = KaplanMeierFitter(label=phenotype.name)
        kmf.fit(durations=_df[durations], event_observed=_df[indicator])
        return kmf
