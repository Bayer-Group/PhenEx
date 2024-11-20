from typing import Dict, List, Optional, Union
import ibis
from ibis.expr.types.relations import Table
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.tables import PhenotypeTable, is_phenex_person_table


class SexPhenotype(Phenotype):
    """
    SexPhenotype is a class that represents a sex-based phenotype. It is able to identify the sex of individuals and filter them based on identified sex.

    Attributes:
        name (str): Name of the phenotype, default is 'sex'.
        allowed_values (List[str]): List of allowed values for the sex column.
        domain (str): Domain of the phenotype, default is 'PERSON'.
        children (list): List of dependent phenotypes.

    Methods:
        _execute(tables: Dict[str, Table]) -> PhenotypeTable:
            Executes the phenotype calculation and returns a table with the filtered individuals.
    """

    def __init__(
        self,
        name: str = "sex",
        allowed_values: Optional[List[Union[str, int, float]]] = None,
        domain: str = "PERSON",
    ):
        self.name = name
        self.allowed_values = allowed_values
        self.domain = domain
        self.children = []
        super(SexPhenotype, self).__init__()

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        person_table = tables[self.domain]
        assert is_phenex_person_table(person_table)

        if self.allowed_values is not None:
            sex_filter = CategoricalFilter(
                column_name="SEX", allowed_values=self.allowed_values
            )
            person_table = sex_filter._filter(person_table)

        return person_table.mutate(VALUE=person_table.SEX, EVENT_DATE=ibis.null())
