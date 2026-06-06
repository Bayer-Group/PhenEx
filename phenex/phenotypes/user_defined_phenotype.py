from typing import Callable, Dict
from datetime import date

import ibis
from ibis import _

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters import DateFilter, ValueFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.aggregators import First, Last

from phenex.util import create_logger

logger = create_logger(__name__)


def UserDefinedPhenotype(
    name: str,
    function: Callable[[Dict[str, "PhenexTable"]], "PhenexTable"],
    returns_value: bool = False,
):
    """
    Use UserDefinedPhenotype as an escape hatch when no built-in phenotype covers your use case. Pass a custom function that receives the mapped tables and returns an ibis table with at minimum a PERSON_ID column. Two main scenarios: (1) hybrid workflows where cohort extraction was done outside PhenEx (e.g. in R or SQL) and you want to inject those results as an entry criterion, and (2) complex custom event logic that cannot be expressed with built-in phenotypes.

    The function must return an ibis table with:
    1. PERSON_ID column (required). If no other columns, all person_ids are assumed to fulfill the phenotype.
    2. Optional BOOLEAN, EVENT_DATE, VALUE columns. BOOLEAN=False patients are excluded. Any other columns are ignored.

    This phenotype returns:
        DATE: Custom, as defined by the user function.
        VALUE: Custom, as defined by the user function.

    Parameters:
        name: The name of the phenotype.
        function: A function that takes mapped_tables as input and returns a PhenotypeTable.

    Example:
        ```python

        # define a custom function that returns at a minimum the PERSON_ID column
        def custom_function(mapped_tables):
            table = mapped_tables['PERSON']
            table = table.filter(table.AGE > 18)
            table = table.select("PERSON_ID")
            return table

        phenotype = UserDefinedPhenotype(
            name="example_phenotype",
            function=custom_function
        )

        tables = {"PERSON": example_code_table}

        result_table = phenotype.execute(tables)
        display(result_table)
        ```
    """

    class _UserDefinedPhenotype(Phenotype):
        def __init__(
            self,
            returns_value,
            **kwargs,
        ):
            self.returns_value = returns_value
            super(_UserDefinedPhenotype, self).__init__(**kwargs)

        def _execute(self, tables) -> PhenotypeTable:
            table = function(tables)

            if "BOOLEAN" not in table.columns:
                table = table.mutate(BOOLEAN=True).distinct()
            else:
                table = table.filter(table.BOOLEAN == True)

            if "EVENT_DATE" not in table.columns:
                table = table.mutate(EVENT_DATE=ibis.null(date))
            if "VALUE" not in table.columns:
                table = table.mutate(VALUE=ibis.null().cast("int32"))

            return table

    # Set output_display_type = as a class variable based on returns_value parameter
    _UserDefinedPhenotype.output_display_type = "value" if returns_value else "boolean"

    return _UserDefinedPhenotype(name=name, returns_value=returns_value)
