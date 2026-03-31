import ibis
from typing import Optional

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters import DateFilter
from phenex.tables import PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns

from phenex.util import create_logger

logger = create_logger(__name__)


class TimeShiftPhenotype(Phenotype):
    """
    TimeShiftPhenotype shifts a base date by the defined number of days.

    The base date is determined as follows:
    - If ``phenotype`` is provided, the base date is ``phenotype.EVENT_DATE``.
    - If ``phenotype`` is ``None``, the base date is the ``INDEX_DATE`` column of the
      domain table identified by ``domain``. A ``ValueError`` is raised at execution
      time if the table has no ``INDEX_DATE`` column.

    If a ``date_range`` is provided, the shifted date is additionally clipped to stay
    within that range. The VALUE column is the number of days between the base date and
    the final (possibly clipped) date.

    DATE: shifted (and optionally clipped) date
    VALUE: number of days between the base date and the final date

    Parameters:
        name: The name of the phenotype.
        phenotype: Optional phenotype whose EVENT_DATE is used as the base date.
        domain: Required when ``phenotype`` is ``None``. The domain table whose
            ``INDEX_DATE`` column is used as the base date.
        days: The number of days to shift. Positive shifts forward, negative backward.
        date_range: Optional DateFilter. The shifted date is clipped to [min_date, max_date].

    Examples:

    Example: Shift an existing phenotype forward by one year
    ```python
        pt_one_year_after_af = TimeShiftPhenotype(
            name="one_year_after_af",
            phenotype=pt_af,
            days=365,
        )
    ```

    Example: Shift INDEX_DATE forward by one year, clipped to study end
    ```python
        pt_one_year_from_index = TimeShiftPhenotype(
            name="one_year_from_index",
            domain="PERSON",
            days=365,
            date_range=DateFilter(max_date=BeforeOrOn("2023-12-31")),
        )
    ```
    """

    output_display_type = "value"

    def __init__(
        self,
        days: int,
        phenotype: Optional[Phenotype] = None,
        domain: Optional[str] = None,
        date_range: Optional[DateFilter] = None,
        **kwargs,
    ):
        super(TimeShiftPhenotype, self).__init__(**kwargs)
        if days is None:
            raise ValueError("days parameter is required")
        if phenotype is None and domain is None:
            raise ValueError("Either phenotype or domain must be provided")
        self.phenotype = phenotype
        self.domain = domain
        self.days = days
        self.date_range = date_range
        if self.phenotype is not None:
            self.add_children(self.phenotype)

    def _execute(self, tables) -> PhenotypeTable:
        if self.phenotype is not None:
            self.phenotype.execute(tables)
            table = self.phenotype.table
            base_date = table.EVENT_DATE
        else:
            table = tables[self.domain]
            if "INDEX_DATE" not in table.columns:
                raise ValueError(
                    f"TimeShiftPhenotype '{self.name}': domain table '{self.domain}' "
                    f"has no INDEX_DATE column."
                )
            table = table.select(["PERSON_ID", "INDEX_DATE"]).distinct()
            base_date = table.INDEX_DATE

        # Preserve base date for VALUE computation
        table = table.mutate(_BASE_DATE=base_date)

        # Shift the date
        shifted = base_date + ibis.interval(days=self.days)

        # Clip to date_range if provided
        if self.date_range is not None:
            if self.date_range.min_value is not None:
                shifted = ibis.greatest(
                    shifted, ibis.literal(self.date_range.min_value.value)
                )
            if self.date_range.max_value is not None:
                shifted = ibis.least(
                    shifted, ibis.literal(self.date_range.max_value.value)
                )

        table = table.mutate(EVENT_DATE=shifted)

        # VALUE = days from base date to the final (possibly clipped) date
        table = table.mutate(
            VALUE=table.EVENT_DATE.cast("date")
            .delta(table._BASE_DATE.cast("date"), "day")
            .cast("float64")
        )

        table = table.drop("_BASE_DATE")
        table = select_phenotype_columns(table)
        return self._perform_final_processing(table)

