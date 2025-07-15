from phenex.filters.filter import Filter
from typing import List, Optional, Union, Dict


class CategoricalFilter(Filter):
    """
    This class filters events in an EventTable based on specified categorical values.

    Attributes:
        column_name (str): The name of the column to filter by.
        allowed_values (List[Union[str, int]]): The list of allowed values for the column.
        domain (Optional[str]): The domain to which the filter applies.
        operator (Optional[str]): The operator used for filtering. Options are "isin", "notin", "isnull", "notnull". Default is "isin". Be aware that "notin" removes null values! Thus "notin" can better be described 'has a value and and is not in'

    Methods:
        filter(table: PhenexTable) -> PhenexTable:
            Filters the given PhenexTable based on the specified column and allowed values.
            Parameters:
                table (PhenexTable): The table containing events to be filtered.
            Returns:
                PhenexTable: The filtered PhenexTable with events matching the allowed values.

        autojoin_filter(table: PhenexTable, tables: dict = None) -> PhenexTable:
            Automatically joins the necessary tables and applies the filter. Use when the input table does not contain the column that defines the filter. For this to work, the tables must specify all required join keys. See DomainsDictionary for details.
            Parameters:
                table (PhenexTable): The table containing events to be filtered.
                tables (dict): A dictionary of tables for joining.
            Returns:
                PhenexTable: The filtered PhenexTable with events matching the allowed values.

    Examples:
        ```
        # Example 1: Filter for SEX = 'Female'
        sex_filter = CategoricalFilter(
            column_name="SEX",
            allowed_values=["Female"],
            domain="PERSON"
        )
        ```

        ```
        # Example 2: Filter for inpatient (domain = encounter)
        inpatient_filter = CategoricalFilter(
            column_name="ENCOUNTER_TYPE",
            allowed_values=["INPATIENT"],
            domain="ENCOUNTER"
        )
        ```

        ```
        # Example 3: Filter for primary diagnosis position
        primary_diagnosis_filter = CategoricalFilter(
            column_name="DIAGNOSIS_POSITION",
            allowed_values=[1],
            domain="DIAGNOSIS"
        )
        ```

        ```
        # Example 4: Applying multiple filters in combination
        inpatient_primary_position = inpatient_filter & primary_diagnosis_filter
        ```

        ```
        # Example 5: Filter for not null status
        primary_diagnosis_filter = CategoricalFilter(
            column_name="DIAGNOSIS_STATUS",
            operator="notnull",
            domain="DIAGNOSIS"
        )
        ```

        ```
        # Example 6: Filter for diagnosis status. Notice that this will remove null rows! Only patients with a value in the diagnosis_status that is NOT history_of will remain.
        primary_diagnosis_filter = CategoricalFilter(
            column_name="DIAGNOSIS_STATUS",
            operator="notin",
            allowed_values=["HISTORY_OF"],
            domain="DIAGNOSIS"
        )
        ```
    """

    def __init__(
        self,
        column_name: str = None,
        allowed_values: Optional[List[Union[str, int]]] = None,
        domain: Optional[str] = None,
        operator: Optional[str] = "isin",
    ):
        self.column_name = column_name
        self.allowed_values = allowed_values
        self.domain = domain
        self.operator = operator
        if operator not in ["isin", "notin", "isnull", "notnull"]:
            raise ValueError(
                f"Invalid operator '{operator}'. Must be one of: 'isin', 'notin', 'isnull', 'notnull'."
            )
        if operator in ["isnull", "notnull"] and allowed_values is not None:
            raise ValueError(
                f"Allowed values should be None for operator '{operator}'."
            )
        super(CategoricalFilter, self).__init__()

    def _filter(self, table: "PhenexTable"):
        # if simply setting the desired column with the categorical filter, return the table without any filtering. This occurs when allowed_values is null, or the operator is 'isnull' or 'notnull'
        if self.allowed_values is None and "null" not in self.operator:
            return table
        if self.operator == "isin" and self.allowed_values:
            table = table.filter(table[self.column_name].isin(self.allowed_values))
        if self.operator == "notin" and self.allowed_values:
            table = table.filter(~table[self.column_name].isin(self.allowed_values))
        if self.operator == "isnull":
            table = table.filter(table[self.column_name].isnull())
        if self.operator == "notnull":
            table = table.filter(~table[self.column_name].isnull())
        return table

    def autojoin_filter(
        self, table: "PhenexTable", tables: Optional[Dict[str, "PhenexTable"]] = None
    ) -> "PhenexTable":
        if self.column_name not in table.columns:
            if self.domain not in tables.keys():
                raise ValueError(
                    f"Table required for categorical filter ({self.domain}) does not exist within domains dicitonary"
                )
            table = table.join(tables[self.domain], domains=tables)
            # TODO downselect to original columns
        return self._filter(table)
