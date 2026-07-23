from typing import Callable, Dict, Optional
from datetime import date
import inspect
import textwrap

import ibis
from ibis import _

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters import DateFilter, ValueFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns
from phenex.aggregators import First, Last

from phenex.util import create_logger

logger = create_logger(__name__)


def _serialize_function(function: Callable) -> str:
    """
    Serialize a user defined function to its source code as a string.
    """
    try:
        source = inspect.getsource(function)
    except (OSError, TypeError) as e:
        raise ValueError(
            "Could not serialize the function passed to UserDefinedPhenotype. "
            "The function must be defined such that its source code is retrievable "
            f"(not a lambda or an interactively defined function): {e}"
        )
    return textwrap.dedent(source)


def _deserialize_function(function_string: str) -> Callable:
    """
    Reconstruct a callable from source code stored as a string.
    """
    namespace: Dict[str, object] = {}
    exec(function_string, namespace)
    functions = [
        value
        for key, value in namespace.items()
        if callable(value) and not key.startswith("__")
    ]
    if not functions:
        raise ValueError(
            "function_string for UserDefinedPhenotype did not define any callable."
        )
    return functions[-1]


class UserDefinedPhenotype(Phenotype):
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

    The user defined function is serialized to (and deserialized from) its source
    code as a string. This allows a UserDefinedPhenotype to be round-tripped
    through `to_dict`/`from_dict`. Either `function` or `function_string` must be
    provided; if both are provided, `function` takes precedence.

    Parameters:
        name: The name of the phenotype.
        function: A function that takes mapped_tables as input and returns a PhenotypeTable.
        function_string: The source code of the function as a string. Used when
            deserializing a UserDefinedPhenotype.
        returns_value: Whether the phenotype returns a value (True) or a boolean (False).

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

    def __init__(
        self,
        name: str,
        function: Optional[
            Callable[[Dict[str, "PhenexTable"]], "PhenexTable"]
        ] = None,
        function_string: Optional[str] = None,
        returns_value: bool = False,
        **kwargs,
    ):
        if function is not None:
            function_string = _serialize_function(function)
        elif function_string is not None:
            function = _deserialize_function(function_string)

        self.function = function
        self.function_string = function_string
        self.returns_value = returns_value
        kwargs.pop("output_display_type", None)
        super().__init__(
            name=name,
            output_display_type="value" if returns_value else "boolean",
            **kwargs,
        )

    def _execute(self, tables) -> PhenotypeTable:
        if self.function is None:
            raise ValueError(
                f"UserDefinedPhenotype '{self.name}' has no function defined and "
                "cannot be executed. Provide a `function` or a `function_string`."
            )

            # Propagate INDEX_DATE from PERSON table when function output lacks it
            if (
                "INDEX_DATE" not in table.columns
                and "PERSON" in tables
                and "INDEX_DATE" in tables["PERSON"].columns
            ):
                person_index = (
                    tables["PERSON"].select("PERSON_ID", "INDEX_DATE").distinct()
                )
                table = table.join(person_index, "PERSON_ID")

            if "BOOLEAN" not in table.columns:
                table = table.mutate(BOOLEAN=True).distinct()
            else:
                table = table.filter(table.BOOLEAN == True)

        if "BOOLEAN" not in table.columns:
            table = table.mutate(BOOLEAN=True).distinct()
        else:
            table = table.filter(table.BOOLEAN == True)

        if "EVENT_DATE" not in table.columns:
            table = table.mutate(EVENT_DATE=ibis.null(date))
        if "VALUE" not in table.columns:
            table = table.mutate(VALUE=ibis.null().cast("int32"))

        return table

    def to_dict(self):
        _dict = super().to_dict()
        # The raw callable is not serializable; persist the source string instead.
        _dict.pop("function", None)
        _dict["function_string"] = self.function_string
        return _dict

