import ibis

from phenex.codelists import Codelist
from phenex.tables import CodeTable, is_phenex_code_table
from phenex.filters.filter import Filter
from typing import List, Tuple
import pandas as pd


class CodelistFilter(Filter):
    """
    CodelistFilter is a class designed to filter a CodeTable based on a specified codelist.

    Attributes:
        codelist (Codelist): The codelist used for filtering the CodeTable.
        name (str): The name of the filter. Defaults to the name of the codelist if not provided.
        use_code_type (bool): A flag indicating whether to use the code type in the filtering process. Defaults to True.
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
