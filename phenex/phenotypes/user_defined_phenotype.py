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
):
    """
    UserDefinedPhenotype allows users of PhenEx to implement custom functionality within a single phenotype. To use, the user must pass a function that returns an ibis table. This means that the function must
    1. return an ibis table
    2. There are a minimum of one column : PERSON_ID. If no other columns are returned, it is assumed that all person_ids in the PERSON_ID column fulfill the UserDefinedPhenotype
    3. If additional columns are returned, they must be named BOOLEAN, EVENT_DATE, and VALUE. The BOOLEAN column indicates whether the person_id fulfills the UserDefinedPhenotype; patients with BOOLEAN = False will be removed. The EVENT_DATE column contains the date of the event, and the VALUE column contains a numeric value associated with the event. Any other columns are ignored.

    UserDefinedPhenotype is especially useful for two use cases :
    1. Hybrid workflows: If you have performed cohort extraction outside of PhenEx (e.g. in R, SQL) but would like to use PhenEx to calculate baseline characteristics and outcomes, we can set the entry criterion to a UserDefinedPhenotype and read a dataframe of PERSON_IDS and INDEX_DATES. In this way, PhenEx flexibly allows us to use multiple tools in our analysis.
    2. Custom event definitions: If you need to define events based on complex logic that is not easily expressed using the built-in PhenEx functionality, you can use UserDefinedPhenotype to implement this logic in a custom function.

    DATE: custom, as defined by user
    VALUE: custom, as defined by user

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
            **kwargs,
        ):
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

    return _UserDefinedPhenotype(name=name)
