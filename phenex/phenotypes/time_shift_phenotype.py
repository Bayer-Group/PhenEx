import ibis
from typing import Optional

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters import DateFilter
from phenex.tables import PhenotypeTable

from phenex.util import create_logger

logger = create_logger(__name__)


class TimeShiftPhenotype(Phenotype):
    """
    TimeShiftPhenotype shifts the EVENT_DATE of an input phenotype by the defined number of days.

    If a `date_range` is provided, the shifted date is additionally clipped to stay within that
    range (analogous to insurance coverage clipping). The VALUE column is then the number of days
    between the original phenotype EVENT_DATE and the final clipped date. Without `date_range`,
    VALUE is the number of days shifted (i.e. `days`).

    DATE: shifted (and optionally clipped) event date
    VALUE: number of days between the original phenotype EVENT_DATE and the final date

    Parameters:
        name: The name of the phenotype.
        phenotype: The phenotype whose EVENT_DATE is shifted.
        days: The number of days to shift. Positive shifts forward, negative backward.
        date_range: Optional DateFilter. The shifted date is clipped so it stays within
            [min_date, max_date]. Periods where the clipped date equals the original
            phenotype date (zero-duration after clipping) are still retained.

    Examples:

    Example: Adding one year to all event dates
    ```python
        pt_af = CodelistPhenotype(
            name="af",
            domain="CONDITION_OCCURRENCE",
            codelist=Codelist(name="af_codes", codelist=["I48"]),
            return_value="all",
        )
        pt_one_year_after_af = TimeShiftPhenotype(
            name="one_year_after_af",
            phenotype=pt_af,
            days=365,
        )
    ```

    Example: Shift forward by one year but clip to a study end date
    ```python
        from phenex.filters.date_filter import DateFilter, BeforeOrOn
        pt_one_year_clipped = TimeShiftPhenotype(
            name="one_year_clipped",
            phenotype=pt_af,
            days=365,
            date_range=DateFilter(max_date=BeforeOrOn("2023-12-31")),
        )
    ```
    """
    output_display_type = "value"

    def __init__(
        self,
        phenotype: Phenotype,
        days: "Value",
        date_range=None,
        **kwargs,
    ):
        super(TimeShiftPhenotype, self).__init__(**kwargs)
        if days is None:
            raise ValueError("days parameter is required")
        self.phenotype = phenotype
        self.days = days
        self.date_range = date_range

    def _execute(self, tables) -> PhenotypeTable:
        self.phenotype.execute(tables)
        table = self.phenotype.table

        # Preserve original date for VALUE computation
        table = table.mutate(_ORIGINAL_EVENT_DATE=table.EVENT_DATE)

        # Shift the date
        shifted = table.EVENT_DATE + ibis.interval(days=self.days)

        # Clip to date_range if provided
        if self.date_range is not None:
            if self.date_range.min_value is not None:
                shifted = ibis.greatest(shifted, ibis.literal(self.date_range.min_value.value))
            if self.date_range.max_value is not None:
                shifted = ibis.least(shifted, ibis.literal(self.date_range.max_value.value))

        table = table.mutate(EVENT_DATE=shifted)

        # VALUE = days from original phenotype date to the final (possibly clipped) date
        table = table.mutate(
            VALUE=table.EVENT_DATE.cast("date").delta(
                table._ORIGINAL_EVENT_DATE.cast("date"), "day"
            ).cast("float64")
        )

        table = table.drop("_ORIGINAL_EVENT_DATE")

        return table

