from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.codelist_filter import CodelistFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_range_filter import DateRangeFilter
from phenex.codelists import Codelist
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable

from ibis import _


class MultipleOccurrencesPhenotype(Phenotype):
    """
    CodelistPhenotype is a class that looks for N occurrences of a event (from an EventTable).

    Attributes:
        name (str): The name of the phenotype.
        phenotype (Phenotype): The phenotype events to look for.
        n_occurrences (int): The minimum number of occurrences to look for.
        date_range (DateRangeFilter, optional): A date range filter to apply.
        relative_time_range (RelativeTimeRangeFilter, optional): A relative time range filter to apply.
        return_date (str): Specifies whether to return the 'first' or 'last' event date.
            Default is 'first'.

    Methods:
        execute(tables: dict) -> PhenotypeTable:
            Executes the filtering process on the provided tables and returns the filtered phenotype table.
            The PhenotypeTable will contain the columns: PERSON_ID, EVENT_DATE, VALUE.
            DATE is determined by the return_date attribute.
            VALUE is equal to the number of occurrences of the event passing all filters.

    Example:
        >>> codelist = Codelist(name="example_codelist", codes=[...])
        >>> date_range = DateRangeFilter(start_date="2020-01-01", end_date="2020-12-31")
        >>> phenotype = CodelistPhenotype(
        ...     name="example_phenotype",
        ...     domain="CONDITION_OCCURRENCE",
        ...     codelist=codelist,
        ...     date_range=date_range,
        ...     return_date='first'
        ... )
        >>> tables = {"CONDITION_OCCURRENCE": example_code_table}
        >>> multiple_occurrences = MultipleOccurrencePhenotype(
            phenoype=phenotype,
            n_occurrences=2,
            return_date='second')
        >>> result_table = multiple_occurrences.execute(tables)
        >>> display(result_table)
    """

    def __init__(
        self,
        name,
        phenotype: Phenotype,
        n_occurrences: int = 2,
        date_range: DateRangeFilter = None,
        relative_time_range: RelativeTimeRangeFilter = None,
        return_date="first",
    ):
        self.name = name
        self.date_range = date_range
        self.relative_time_range = relative_time_range
        self.return_date = return_date
        self.n_occurrences = n_occurrences
        self.phenotype = phenotype
        self.children = [phenotype]
        super(MultipleOccurrencePhenotype, self).__init__()

    def _execute(self, tables) -> PhenotypeTable:
        # Execute the child phenotype to get the initial filtered table
        phenotype_table = self.phenotype.table

        # Apply date range filter if provided
        if self.date_range is not None:
            phenotype_table = self.date_range.filter(phenotype_table)

        # Apply relative time range filter if provided
        if self.relative_time_range is not None:
            phenotype_table = self.relative_time_range.filter(phenotype_table)

        # Select only distinct dates:
        phenotype_table = phenotype_table.select(["PERSON_ID", "EVENT_DATE"]).distinct()

        # Count occurrences per PERSON_ID
        occurrence_counts = phenotype_table.group_by("PERSON_ID").aggregate(
            VALUE=_.count(), first_date=_.EVENT_DATE.min(), last_date=_.EVENT_DATE.max()
        )

        # Filter to keep only those with at least n_occurrences
        filtered_table = occurrence_counts[
            occurrence_counts.VALUE >= self.n_occurrences
        ]

        # Determine the return date based on the return_date attribute
        if self.return_date == "first":
            filtered_table = filtered_table.mutate(
                EVENT_DATE=filtered_table.first_date,
            )
        elif self.return_date == "second":
            filtered_table = filtered_table.mutate(
                EVENT_DATE=filtered_table.second_date,
            )
        elif self.return_date == "last":
            filtered_table = filtered_table.mutate(
                EVENT_DATE=filtered_table.last_date,
            )

        # Select the required columns
        result_table = filtered_table.select(PHENOTYPE_TABLE_COLUMNS)

        return result_table
