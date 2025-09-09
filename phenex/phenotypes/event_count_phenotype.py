from ibis import _

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters import DateFilter, ValueFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.aggregators import First, Last

from phenex.util import create_logger

logger = create_logger(__name__)


class EventCountPhenotype(Phenotype):
    """
    EventCountPhenotype counts the number of events that occur on distinct days. It is additionally able to filter patients based on:
    1. the number of distinct days an event occurred, by setting value_filter
    2. the number of days between pairs of events

    EventCountPhenotype is a composite phenotype, meaning that it does not directly operate on source data and takes a phenotype as an argument. The phenotype passed to EventCountPhenotype must have return_date set to 'all' (if return_date on the provided phenotype is set to `first` or `last`, there will only be one event per patient...)


    DATE: The event date selected based on `component_date_select` and `return_date` parameters. `return_date` returns multiple rows per patient for all events that fulfill criteria. `return_date` first is the first fulfilling event date, last the last. If component_date_select = 'first' the returned date is a pair of events, if component_date_select = 'second' we return the second of a pair of events.
    VALUE: The number of days that the phenotype of interest has occurred i.e. if 4, that means the phenotype has occurred on 4 distinct days.

    Parameters:
        name: The name of the phenotype.
        phenotype: The phenotype that returns events of interest. Note that return_date must be set to `all` or an error will be thrown.
        value_filter: Set the minimum and/or maximum number of distinct days on which an event may occur.
        relative_time_range: Set the minimum and/or maximum number of days that are allowed to occur between any pair of events.
        return_date: Specifies whether to return the 'first', 'last', or 'all' dates on which the criteria are fulfilled. Default is 'first'.
        component_date_select: Specifies whether to return the 'first' or 'second' event date within each pair of events. Default is 'second'. It is highly recommended to never use 'first', as there is a high risk of introducing immortal time bias.

    Example:
        ```python
        codelist = Codelist(name="example_codelist", codes=[...])

        phenotype = CodelistPhenotype(
            name="example_phenotype",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date='first'
        )

        tables = {"CONDITION_OCCURRENCE": example_code_table}
        multiple_occurrences = EventCountPhenotype(
            phenotype=phenotype,
            value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(2)),
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(90),
                max_days=LessThanOrEqualTo(180)
            ),
            return_date='first',
            component_date_select='second'
        )

        result_table = multiple_occurrences.execute(tables)
        display(result_table)
        ```
    """

    def __init__(
        self,
        phenotype: Phenotype,
        value_filter: ValueFilter = None,
        relative_time_range: RelativeTimeRangeFilter = None,
        return_date="first",
        component_date_select="second",
        **kwargs,
    ):
        super(EventCountPhenotype, self).__init__(**kwargs)
        self.relative_time_range = relative_time_range
        self.return_date = return_date
        self.component_date_select = component_date_select
        if self.component_date_select not in ["first", "second"]:
            raise ValueError(
                f"Invalid component_date_select: {self.component_date_select}"
            )
        self.value_filter = value_filter
        self.phenotype = phenotype
        self.add_children(phenotype)

    def _execute(self, tables) -> PhenotypeTable:
        # Execute the child phenotype to get the initial table to filter
        if self.phenotype.return_date != "all":
            raise ValueError(
                "EventCountPhenotype requires that return_date is set to all on its component phenotype"
            )
        table = self.phenotype.table

        # Select only distinct dates:
        table = table.select(["PERSON_ID", "EVENT_DATE"]).distinct()

        # Count occurrences per PERSON_ID
        occurrence_counts_table = table.group_by("PERSON_ID").aggregate(VALUE=_.count())
        table, occurrence_counts_table = self._perform_value_filtering(
            table, occurrence_counts_table
        )
        table = self._perform_relative_time_range_filtering(table)
        table = self._perform_date_selection(table)
        table = table.left_join(
            occurrence_counts_table.select("PERSON_ID", "VALUE"),
            table.PERSON_ID == occurrence_counts_table.PERSON_ID,
        ).select("PERSON_ID", "EVENT_DATE", "VALUE")

        table = table.mutate(BOOLEAN=True).distinct()
        return table

    def _perform_value_filtering(self, table, occurrence_counts_table):
        if self.value_filter is not None:
            occurrence_counts_table = self.value_filter.filter(occurrence_counts_table)
            table = table.right_join(
                occurrence_counts_table,
                table.PERSON_ID == occurrence_counts_table.PERSON_ID,
            ).select(["PERSON_ID", "EVENT_DATE", "VALUE"])
        return table, occurrence_counts_table

    def _perform_relative_time_range_filtering(self, table):
        if self.relative_time_range is not None:
            # make sure that the 'when' keyword parameter is correctly set to after
            self.relative_time_range.when = "after"
            # Self join and rename event_date columns;
            # the first dates will be called INDEX_DATE
            # the second dates will be called EVENT_DATE
            first_table = table.select(
                "PERSON_ID",
                table.EVENT_DATE.name("INDEX_DATE"),
            )
            second_table = table.select(
                "PERSON_ID",
                table.EVENT_DATE.name("EVENT_DATE"),
            )
            table = first_table.join(
                second_table, first_table.PERSON_ID == second_table.PERSON_ID
            )

            table = table.filter(table.INDEX_DATE <= table.EVENT_DATE)
            # perform relative time range filtering; the first date is the anchor ('index_date')
            table = self.relative_time_range.filter(table)

            if self.component_date_select == "first":
                table = table.select("PERSON_ID", "INDEX_DATE").rename(
                    {"EVENT_DATE": "INDEX_DATE"}
                )
            elif self.component_date_select == "second":
                table = table.select("PERSON_ID", "EVENT_DATE")
        return table

    def _perform_date_selection(self, table, reduce=True):
        if self.return_date is None or self.return_date == "all":
            return table
        if self.return_date == "first":
            aggregator = First(reduce=reduce)
        elif self.return_date == "last":
            aggregator = Last(reduce=reduce)
        else:
            raise ValueError(f"Unknown return_date: {self.return_date}")
        table = aggregator.aggregate(table)
        return table.select("PERSON_ID", "EVENT_DATE")
