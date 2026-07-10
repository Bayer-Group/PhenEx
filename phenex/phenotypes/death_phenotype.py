from typing import Dict, Optional, Union, List
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from ibis.expr.types.relations import Table
from phenex.phenotypes.phenotype import Phenotype
from phenex.tables import PhenotypeTable, is_phenex_person_table
import ibis


from phenex.filters.date_filter import DateFilter


class DeathPhenotype(Phenotype):
    """
    DeathPhenotype is a class that represents a death-based phenotype. It filters individuals
    who have died and returns their date of death.

    Parameters:
        name: Name of the phenotype, default is 'death'.
        domain: Domain of the phenotype, default is 'PERSON'.
        date_range: A date range filter to apply.
        relative_time_range: Filter patients relative to some date (e.g. death after discharge from hospital)

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)
        VALUE: The number of days from the anchor date to the death date (day difference). Negative values indicate death before the anchor date.
    """

    output_display_type = "value"

    def __init__(
        self,
        name: Optional[str] = "DEATH",
        domain: str = "PERSON",
        date_range: DateFilter = None,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        **kwargs,
    ):
        super(DeathPhenotype, self).__init__(name=name, **kwargs)
        self.domain = domain
        self.date_range = date_range
        self.relative_time_range = relative_time_range
        if self.relative_time_range is not None:
            if isinstance(self.relative_time_range, RelativeTimeRangeFilter):
                self.relative_time_range = [self.relative_time_range]
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    if not any(c is rtr.anchor_phenotype for c in self.children):
                        self.add_children(rtr.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        person_table = tables[self.domain]
        assert is_phenex_person_table(person_table)

        if "MONTH_OF_DEATH" in person_table.columns:
            month_of_death = person_table.MONTH_OF_DEATH.cast("int64")
            month_date = ibis.date(
                month_of_death // 100,
                month_of_death % 100,
                15,
            )
            if "DATE_OF_DEATH" in person_table.columns:
                date_of_death = ibis.coalesce(
                    ibis.date(person_table.DATE_OF_DEATH), month_date
                )
            else:
                date_of_death = month_date
        else:
            date_of_death = ibis.date(person_table.DATE_OF_DEATH)

        person_table = person_table.mutate(EVENT_DATE=date_of_death)
        death_table = person_table.filter(person_table.EVENT_DATE.notnull())

        if self.date_range is not None:
            death_table = self.date_range.filter(death_table)

        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                death_table = rtr.filter(death_table)

            from phenex.phenotypes.functions import attach_anchor_and_get_reference_date

            rtr0 = self.relative_time_range[0]
            death_table, reference_column = attach_anchor_and_get_reference_date(
                death_table, anchor_phenotype=rtr0.anchor_phenotype
            )
            day_diff = (-reference_column.delta(death_table.EVENT_DATE, "day")).cast(
                "float64"
            )
            death_table = death_table.mutate(VALUE=day_diff)
        else:
            death_table = death_table.mutate(VALUE=ibis.null("float64"))

        death_table = death_table.mutate(BOOLEAN=True)
        return death_table.select(["PERSON_ID", "EVENT_DATE", "VALUE", "BOOLEAN"])
