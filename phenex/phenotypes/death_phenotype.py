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
        **kwargs
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
                    self.add_children(rtr.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        person_table = tables[self.domain]
        person_table = person_table.mutate(EVENT_DATE=person_table.DATE_OF_DEATH)
        assert is_phenex_person_table(person_table)

        death_table = person_table.filter(person_table.DATE_OF_DEATH.notnull())
        if self.date_range is not None:
            death_table = self.date_range.filter(death_table)

        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                death_table = rtr.filter(death_table)

            # Compute VALUE = death_date - anchor_date using the first filter's anchor.
            # attach_anchor_and_get_reference_date joins the anchor phenotype if provided,
            # otherwise reads INDEX_DATE directly from the table.
            # NOTE: Filter.filter() strips any columns added during filtering (e.g.
            # DAYS_FROM_ANCHOR), so we must compute the day diff explicitly here.
            from phenex.phenotypes.functions import attach_anchor_and_get_reference_date

            rtr0 = self.relative_time_range[0]
            death_table, reference_column = attach_anchor_and_get_reference_date(
                death_table, anchor_phenotype=rtr0.anchor_phenotype
            )
            # reference_column.delta(b) = reference - b  (anchor - death)
            # We want death - anchor, so negate.
            day_diff = (-reference_column.delta(death_table.EVENT_DATE, "day")).cast(
                "float64"
            )
            death_table = death_table.mutate(VALUE=day_diff)
        else:
            death_table = death_table.mutate(VALUE=ibis.null("float64"))

        death_table = death_table.mutate(BOOLEAN=True)
        death_table = death_table.mutate(EVENT_DATE=death_table.DATE_OF_DEATH)
        return death_table.select(["PERSON_ID", "EVENT_DATE", "VALUE", "BOOLEAN"])
