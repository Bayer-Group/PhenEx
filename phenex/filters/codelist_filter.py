import ibis

from phenex.codelists import Codelist
from phenex.tables import CodeTable, is_phenex_code_table, PhenexTable
from phenex.filters.filter import Filter
from typing import List, Tuple, Optional, Dict
import pandas as pd


class CodelistFilter(Filter):
    """
    CodelistFilter is a class designed to filter a CodeTable based on a specified codelist.
    
    The filter automatically detects where codes are defined by checking the CodeTable's 
    CODES_DEFINED_IN property. If CODES_DEFINED_IN is set to a domain name (e.g., "concept"),
    the filter will use autojoin to reach that table. If CODES_DEFINED_IN is None, codes 
    are assumed to be in the current table.

    Attributes:
        codelist (Codelist): The codelist used for filtering the CodeTable.
        name (str): The name of the filter. Defaults to the name of the codelist if not provided.
    """

    def __init__(self, codelist: Codelist, name=None):
        self.codelist = codelist
        self.name = name or self.codelist.name
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
        
        The filter checks the table's CODES_DEFINED_IN property to determine where codes are located:
        - If CODES_DEFINED_IN is None: codes are in the current table, filter directly
        - If CODES_DEFINED_IN is set: codes are in another table, perform autojoin to reach it
        
        This design allows the table mapper to control where codes are located, keeping the
        phenotype and filter logic clean and unaware of database schema details.
        
        Parameters:
            table (CodeTable): The table containing events to be filtered.
            tables (dict): A dictionary of tables from the DomainsDictionary for joining.
            
        Returns:
            CodeTable: The filtered CodeTable with events matching the codelist.
            
        Examples:
            ```
            # Example 1: Codes in the table itself (traditional pattern)
            class ConditionOccurrenceTable(CodeTable):
                CODES_DEFINED_IN = None  # Codes are in this table
                DEFAULT_MAPPING = {
                    "CODE": "CONDITION_CONCEPT_ID",
                    "CODE_TYPE": "VOCABULARY_ID"
                }
            
            # Example 2: Codes in a separate concept table (autojoin pattern)
            class EventWithoutCodesTable(CodeTable):
                CODES_DEFINED_IN = "CONCEPT"  # NAME_TABLE of table containing codes
                JOIN_KEYS = {"EventMappingTable": ["EVENTMAPPINGID"]}
                PATHS = {"ConceptTable": ["EventMappingTable"]}
            
            # Usage is identical regardless of where codes are:
            codelist_filter = CodelistFilter(codelist)
            filtered = codelist_filter.autojoin_filter(table, tables)
            ```
        """
        # Check if table specifies where codes are defined
        codes_domain = getattr(table, 'CODES_DEFINED_IN', None)
        
        # Check if CODE and CODE_TYPE columns exist in the current table
        has_code = "CODE" in table.columns
        has_code_type = "CODE_TYPE" in table.columns if self.codelist.use_code_type else True
        
        if not (has_code and has_code_type):
            # Need to join to get CODE/CODE_TYPE columns
            if codes_domain is None:
                raise ValueError(
                    f"CodeTable {table.__class__.__name__} does not have CODE/CODE_TYPE columns "
                    "and CODES_DEFINED_IN is not set. Either add CODE/CODE_TYPE columns to the "
                    "table mapping or set CODES_DEFINED_IN to specify which table contains the codes."
                )
            if tables is None:
                raise ValueError(
                    f"Table required for codelist filter ({codes_domain}) but 'tables' parameter is None. "
                    "Pass the domains dictionary via the 'tables' parameter."
                )
            
            # Find the target table and perform autojoin
            target_table = self._find_target_table(codes_domain, tables)
            original_columns = table.columns
            table = table.join(target_table, domains=tables)
            
            # Apply the codelist filter
            filtered_table = self._filter(table)
            
            # Restore original column structure (plus any columns needed from join)
            # This ensures we don't pollute the output with unnecessary joined columns
            columns_to_keep = list(set(original_columns) & set(filtered_table.columns))
            return type(table)(filtered_table.select(columns_to_keep))
        
        # If CODE/CODE_TYPE already exist, just apply the filter directly
        return self._filter(table)

    def _find_target_table(
        self, codes_domain: str, tables: Dict[str, PhenexTable]
    ) -> PhenexTable:
        """
        Find the target table containing codes by searching for NAME_TABLE or class name match.
        
        Parameters:
            codes_domain: The NAME_TABLE or class name to search for
            tables: Dictionary of available tables
            
        Returns:
            The matching PhenexTable
            
        Raises:
            ValueError: If no matching table is found
        """
        for domain_key, domain_table in tables.items():
            table_name = getattr(domain_table, 'NAME_TABLE', None)
            class_name = domain_table.__class__.__name__
            if table_name == codes_domain or class_name == codes_domain:
                return domain_table
        
        # No match found - provide helpful error message
        available_tables = [
            f"{t.__class__.__name__} (NAME_TABLE={getattr(t, 'NAME_TABLE', 'N/A')})" 
            for t in tables.values()
        ]
        raise ValueError(
            f"Table required for codelist filter ({codes_domain}) not found. "
            f"Searched by NAME_TABLE and class name. Available tables: {', '.join(available_tables)}"
        )
