from phenex.filters.filter import Filter
from typing import List, Optional, Union, Dict


class CategoricalFilter(Filter):
    """
    This class filters events in an EventTable based on specified categorical values.

    Attributes:
        column_name (str): The name of the column to filter by.
        allowed_values (List[Union[str, int]]): The list of allowed values for the column.
        domain (Optional[str]): The domain to which the filter applies.

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
        # Example 1: Filter for SEX = 'Female'
        sex_filter = CategoricalFilter(
            column_name="SEX",
            allowed_values=["Female"],
            domain="PERSON"
        )

        # Example 2: Filter for inpatient (domain = encounter)
        inpatient_filter = CategoricalFilter(
            column_name="ENCOUNTER_TYPE",
            allowed_values=["INPATIENT"],
            domain="ENCOUNTER"
        )

        # Example 3: Filter for primary diagnosis position
        primary_diagnosis_filter = CategoricalFilter(
            column_name="DIAGNOSIS_POSITION",
            allowed_values=[1],
            domain="DIAGNOSIS"
        )

        # Example 4: Applying multiple filters in combination
        inpatient_primary_position = inpatient_filter & primary_diagnosis_filter
    """

    def __init__(
        self,
        column_name: str,
        allowed_values: List[Union[str, int]],
        domain: Optional[str] = None,
    ):
        self.column_name = column_name
        self.allowed_values = allowed_values
        self.domain = domain
        super(CategoricalFilter, self).__init__()

    def _filter(self, table: "PhenexTable"):
        return table.filter(table[self.column_name].isin(self.allowed_values))

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
        return table.filter(table[self.column_name].isin(self.allowed_values))
