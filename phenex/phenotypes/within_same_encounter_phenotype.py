from typing import Union
from phenex.phenotypes.phenotype import Phenotype


class WithinSameEncounterPhenotype(Phenotype):
    def __init__(
        self,
        name: str,
        anchor_phenotype: Union["CodelistPhenotype", "MeasurementPhenotype"],
        phenotype: Union["CodelistPhenotype", "MeasurementPhenotype"],
        column_name: str,
        **kwargs,
    ):
        super(WithinSameEncounterPhenotype, self).__init__(**kwargs)
        self.name = name
        self.anchor_phenotype = anchor_phenotype
        self.phenotype = phenotype
        self.column_name = column_name
        self.children.append(self.anchor_phenotype)

    def _execute(self, tables) -> "PhenotypeTable":
        # Subset the raw anchor data that occurs on the same day as the anchor date in order to get the column of interest
        _anchor_table = tables[self.anchor_phenotype.domain]
        _anchor_table = _anchor_table.join(
            self.anchor_phenotype.table,
            (self.anchor_phenotype.table.PERSON_ID == _anchor_table.PERSON_ID)
            & (self.anchor_phenotype.table.EVENT_DATE == _anchor_table.EVENT_DATE),
            how="inner",
        ).select(["PERSON_ID", self.column_name])

        # Subset the target phenotype raw data for patient id and column name of interest
        _table = tables[self.phenotype.domain]
        _table = _table.join(
            _anchor_table,
            (_anchor_table.PERSON_ID == _table.PERSON_ID)
            & (_anchor_table[self.column_name] == _table[self.column_name]),
            how="inner",
        )

        # run the target phenotype on the subsetted data
        return self.phenotype._execute({self.phenotype.domain: _table})
