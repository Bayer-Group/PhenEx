import ibis
from ibis import _
from typing import Dict, List, Union, Optional

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters import DateFilter, ValueFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.aggregators import First, Last
from phenex.codelists import Codelist

from phenex.util import create_logger

logger = create_logger(__name__)


class TimeShiftPhenotype(Phenotype):
    """
    TimeShiftPhenotype shifts the EVENT_DATE of an input phenotype by the defined number of days.

    DATE: The event date selected from the input phenotype plus the defined number of days
    VALUE: NULL

    Parameters:
        name: The name of the phenotype.
        phenotype: The phenotype that returns values of interest (AgePhenotype, MeasurementPhenotype, CodelistPhenotype, etc.)
        days: The number of days to shift the event date. Positive values shift forward in time, negative values shift backward.

    Examples:

    Example: Adding one year to all event dates
    ```python
        # Continuous binning example
        from phenex.phenotypes import AgePhenotype

        pt_af = CodelistPhenotype(
            name="af",
            domain="CONDITION_OCCURRENCE",
            codelist=Codelist(
                name="af_codes",
                codelist=["I48", "I48.0", "I48.1", "I48.2", "I48.3", "I48.4", "I48.9"]
            ),
            return_value="all"
        )
        pt_one_year_after_af = TimeShiftPhenotype(
            name="one_year_after_af",
            phenotype=pt_af,
            days=365
        )
    ```
    """

    def __init__(
        self,
        phenotype: Phenotype,
        days: "Value",
        **kwargs,
    ):
        super(TimeShiftPhenotype, self).__init__(**kwargs)
        if days is None:
            raise ValueError("days parameter is required")
        self.phenotype = phenotype
        self.days = days

    def _execute(self, tables) -> PhenotypeTable:
        # Execute the child phenotype to get the initial table to filter
        self.phenotype.execute(tables)
        table = self.phenotype.table

        table = table.mutate(
            EVENT_DATE=table.EVENT_DATE + ibis.interval(days=self.days)
        )

        return table