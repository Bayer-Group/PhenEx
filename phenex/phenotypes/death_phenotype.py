from typing import Dict
from ibis.expr.types.relations import Table
from phenex.phenotypes.phenotype import Phenotype
from phenex.tables import PhenotypeTable, is_phenex_person_table

class DeathPhenotype(Phenotype):
    """
    DeathPhenotype is a class that represents a death-based phenotype. It filters individuals
    who have died and returns their date of death.

    Attributes:
        name (str): Name of the phenotype, default is 'death'.
        domain (str): Domain of the phenotype, default is 'PERSON'.
        children (list): List of dependent phenotypes.

    Methods:
        _execute(tables: Dict[str, Table]) -> PhenotypeTable:
            Executes the phenotype calculation and returns a table with the filtered individuals.
    """

    def __init__(self, name: str = "death", domain: str = "PERSON"):
        self.name = name
        self.domain = domain
        self.children = []
        super(DeathPhenotype, self).__init__()

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        person_table = tables[self.domain]
        assert is_phenex_person_table(person_table)

        death_table = person_table.filter(person_table.DEATH_DATE.notnull())
        return death_table.mutate(EVENT_DATE=death_table.DEATH_DATE)