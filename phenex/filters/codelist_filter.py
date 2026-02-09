import ibis

from phenex.codelists import Codelist
from phenex.tables import CodeTable, is_phenex_code_table, PhenexTable
from phenex.filters.filter import Filter
from typing import List, Tuple, Optional, Dict
import pandas as pd


class CodelistFilter(Filter):
    """
    CodelistFilter is a class designed to filter a CodeTable based on a specified codelist.

    Attributes:
        codelist (Codelist): The codelist used for filtering the CodeTable.
        name (str): The name of the filter. Defaults to the name of the codelist if not provided.
        use_code_type (bool): A flag indicating whether to use the code type in the filtering process. Defaults to True.
        domain (Optional[str]): The domain to which the codelist applies. Used for autojoin functionality when CODE/CODE_TYPE are in a different table.
    """

    def __init__(self, codelist: Codelist, name=None, domain=None):
        self.codelist = codelist
        self.name = name or self.codelist.name
        self.domain = domain
        self.codelist_as_tuples = self._convert_codelist_to_tuples()
        super(CodelistFilter, self).__init__()

    def _convert_codelist_to_tuples(self) -> List[Tuple[str, str]]:
        if self.codelist is not None:
            if not isinstance(self.codelist, Codelist):
                raise ValueError("Codelist must be an instance of Codelist")
            return [
                (ct, c)
                for ct, codes in self.codelist.resolved_codelist.items()
                for c in codes
            ]
        return []

    def _filter(self, code_table: CodeTable) -> CodeTable:
        assert is_phenex_code_table(code_table)

        if self.codelist.fuzzy_match:
            return self._filter_fuzzy_codelist(code_table)
        else:
            return self._filter_literal_codelist(code_table)

    def _filter_fuzzy_codelist(self, code_table):
        filter_condition = False
        for code_type, codelist in self.codelist.resolved_codelist.items():
            codelist = [str(code) for code in codelist]
            if self.codelist.use_code_type:
                filter_condition = filter_condition | (
                    (code_table.CODE_TYPE == code_type)
                    & (code_table.CODE.cast("str").like(codelist))
                )
            else:
                filter_condition = filter_condition | code_table.CODE.cast("str").like(
                    codelist
                )

        filtered_table = code_table.filter(filter_condition)
        return filtered_table

    def _filter_literal_codelist(self, code_table):
        # Generate the codelist table as an Ibis literal set
        codelist_df = pd.DataFrame(
            self.codelist_as_tuples, columns=["code_type", "code"]
        ).fillna("")
        codelist_table = ibis.memtable(codelist_df)

        # Create a join condition based on code and possibly code_type
        code_column = code_table.CODE
        if self.codelist.use_code_type:
            code_type_column = code_table.CODE_TYPE
            join_condition = (
                code_column.cast("str") == codelist_table.code.cast("str")
            ) & (code_type_column == codelist_table.code_type)
        else:
            join_condition = code_column.cast("str") == codelist_table.code.cast("str")

        # return table with downselected columns, of same type as input table
        filtered_table = code_table.inner_join(codelist_table, join_condition).select(
            code_table.columns
        )
        return filtered_table

    def autojoin_filter(
        self, table: CodeTable, tables: Optional[Dict[str, PhenexTable]] = None
    ) -> CodeTable:
        """
        Automatically joins the necessary tables and applies the codelist filter.
        Use when the input table does not contain CODE/CODE_TYPE columns that define the filter.
        
        This is particularly useful when codelist codes are in a concept/reference table that 
        requires joining through intermediate tables (e.g., CONDITION_OCCURRENCE -> CONCEPT).
        
        Parameters:
            table (CodeTable): The table containing events to be filtered.
            tables (dict): A dictionary of tables from the DomainsDictionary for joining.
            
        Returns:
            CodeTable: The filtered CodeTable with events matching the codelist.
            
        Examples:
            ```
            # Example 1: Filter conditions using concept table (requires 2 joins)
            # CONDITION_OCCURRENCE -> VISIT_OCCURRENCE -> CONCEPT
            concept_codelist = Codelist(
                codelist={"ICD10CM": ["I48.0", "I48.1"]},
                name="afib_concepts",
                use_code_type=True
            )
            codelist_filter = CodelistFilter(
                codelist=concept_codelist,
                domain="CONCEPT"
            )
            # Will automatically join through necessary tables to reach CONCEPT
            filtered = codelist_filter.autojoin_filter(condition_table, tables=omop_tables)
            ```
        """
        # Check if CODE and CODE_TYPE columns exist in the current table
        has_code = "CODE" in table.columns
        has_code_type = "CODE_TYPE" in table.columns if self.codelist.use_code_type else True
        
        if not (has_code and has_code_type):
            # Need to join to get CODE/CODE_TYPE columns
            if self.domain is None:
                raise ValueError(
                    "CodelistFilter requires 'domain' parameter when CODE/CODE_TYPE "
                    "columns are not present in the input table. Specify the domain "
                    "containing the codelist codes (e.g., 'CONCEPT')."
                )
            if tables is None or self.domain not in tables.keys():
                raise ValueError(
                    f"Table required for codelist filter ({self.domain}) does not exist "
                    "within domains dictionary. Ensure the domain is included in your "
                    "DomainsDictionary and passed via the 'tables' parameter."
                )
            
            # Store original columns to preserve table structure
            original_columns = table.columns
            
            # Perform autojoin to the target domain
            table = table.join(tables[self.domain], domains=tables)
            
            # Apply the codelist filter
            filtered_table = self._filter(table)
            
            # Restore original column structure (plus any columns needed from join)
            # This ensures we don't pollute the output with unnecessary joined columns
            columns_to_keep = list(set(original_columns) & set(filtered_table.columns))
            return type(table)(filtered_table.select(columns_to_keep))
        
        # If CODE/CODE_TYPE already exist, just apply the filter directly
        return self._filter(table)
