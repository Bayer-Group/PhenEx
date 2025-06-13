from typing import Optional, List
from lifelines import KaplanMeierFitter
import matplotlib.pyplot as plt
import ibis

from phenex.reporting import Reporter
from phenex.util import create_logger

logger = create_logger(__name__)


class TimeToEvent(Reporter):
    """
    Perform a time to event analysis.

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
        print(table)
        table = self._append_days_to_event(table)
        print(table)
        table = self._append_date_and_days_to_first_event(table)
        self.table = table
        print(table)
        logger.info("time to event finished execution")
        self.plot_kaplan_meier()

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
            print("appending dates for", _phenotype.name)
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
            print("appending time to event for", column_name)
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
            if self.end_of_study_period is not None:
                cols.append("END_OF_STUDY_PERIOD")

            # Creating a new column with the minimum date from the specified columns
            min_date_column = ibis.coalesce(*(table[col] for col in cols))

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

    def plot_kaplan_meier(self):
        """
        For each outcome, plot a kaplan meier curve.
        """
        # subset for current codelist
        fig, axes = plt.subplots(1, len(self.cohort.outcomes), sharey=True)

        for i, phenotype in enumerate(self.cohort.outcomes):
            indicator = f"INDICATOR_{phenotype.name.upper()}"
            durations = f"DAYS_FIRST_EVENT_{phenotype.name.upper()}"
            _df = self.table.select([indicator, durations]).to_pandas()
            kmf = KaplanMeierFitter(label=phenotype.name)
            kmf.fit(durations=_df[durations], event_observed=_df[indicator])
            kmf.plot(ax=axes[i])
        plt.show()
