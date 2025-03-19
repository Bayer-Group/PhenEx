from typing import Dict, Optional, Union, List
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from ibis.expr.types.relations import Table
from phenex.phenotypes.phenotype import Phenotype
from phenex.tables import PhenotypeTable, is_phenex_person_table
import ibis


class DeathPhenotype(Phenotype):
    """
    DeathPhenotype is a class that represents a death-based phenotype. It filters individuals
    who have died and returns their date of death.

    Parameters:
        name: Name of the phenotype, default is 'death'.
        domain: Domain of the phenotype, default is 'PERSON'.
        relative_time_range: Filter patients relative to some date (e.g. death after discharge from hospital)

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)
    """

    def __init__(
        self,
        name: str = "death",
        domain: str = "PERSON",
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        **kwargs
    ):
        self.name = name
        self.domain = domain
        self.children = []
        self.relative_time_range = relative_time_range
        if self.relative_time_range is not None:
            if isinstance(self.relative_time_range, RelativeTimeRangeFilter):
                self.relative_time_range = [self.relative_time_range]
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    self.children.append(rtr.anchor_phenotype)
        super(DeathPhenotype, self).__init__(**kwargs)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        person_table = tables[self.domain]
        person_table = person_table.mutate(EVENT_DATE=person_table.DATE_OF_DEATH)
        assert is_phenex_person_table(person_table)

        death_table = person_table.filter(person_table.DATE_OF_DEATH.notnull())
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                death_table = rtr.filter(death_table)
        death_table = death_table.mutate(VALUE=ibis.null())
        return death_table.mutate(EVENT_DATE=death_table.DATE_OF_DEATH)
