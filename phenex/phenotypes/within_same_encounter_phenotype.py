from typing import Union
from phenex.phenotypes.phenotype import Phenotype


class WithinSameEncounterPhenotype(Phenotype):
    """
    WithinSameEncounterPhenotype is a phenotype that filters a target phenotype based on the occurrence of an anchor phenotype within the same encounter. This phenotype can only be used with CodelistPhenotypes and MeasurementPhenotypes as anchor/phenotype.

    Parameters:
        name: The name of the phenotype. Optional. If not passed, name will be derived from the name of the codelist.
        anchor_phenotype: The phenotype which should define the encounter of interest
        phenotype: The phenotype which should occur within the same encounter of interest, defined by the anchor_phenotype
        column_name: The name of the column which must be shared between anchor_phenotype and phenotype


    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Examples:

    Example: Imaging procedure within the same encounter as Pulmonary Embolism (OMOP)
        ```python
        from phenex.phenotypes import CodelistPhenotype, WithinSameEncounterPhenotype
        from phenex.codelists import Codelist
        from phenex.mappers import OMOPDomains
        from phenex.filters import DateFilter, CategoricalFilter, Value
        from phenex.ibis_connect import SnowflakeConnector

        pe_diagnosis = CodelistPhenotype(
            name = "diagnosis_of_PE",
            domain = "CONDITION_OCCURRENCE",
            codelist = Codelist(codelist={'SNOMED': [608954, 4120091, 45768439, 45768888, 37165995, 436768, 44782732, 45768887, 45771016, 4017134, 4240832, 4129841, 43530934, 4219469, 442055, 442051, 442050, 433545, 437060, 435026, 433832, 440477, 439380, 439379, 4331168, 4108681, 37160752, 4091708, 1244882, 440417, 37109911, 3655209, 3655210, 45757145, 37016922, 43530605, 4119608, 4253796, 45766471, 4121618, 4236271, 36713113, 35615055, 40479606, 4119607, 4119609]}).copy(use_code_type=False),
            return_date = "first",
        )

        # where column id alone is idnetical left join
        imaging = CodelistPhenotype(
            name = 'imaging',
            domain = 'PROCEDURE_OCCURRENCE',
            codelist = Codelist(codelist={'CPT4': [2211381, 2211379, 2211380, 2212002, 2212004, 2212003, 2212011, 42742555, 42742554, 2212006, 2212005, 2212008, 2212010, 2212009, 42742557, 42742556]}).copy(use_code_type=False),
        )


        imaging_in_entry_hospitalization = WithinSameEncounterPhenotype(
            name='imaging_in_entry_hospitalization',
            anchor_phenotype = pe_diagnosis,
            phenotype = imaging,
            column_name = 'VISIT_OCCURRENCE_ID'
        )

        ```
    """

    def __init__(
        self,
        anchor_phenotype: Union["CodelistPhenotype", "MeasurementPhenotype"],
        phenotype: Union["CodelistPhenotype", "MeasurementPhenotype"],
        column_name: str,
        **kwargs,
    ):
        super(WithinSameEncounterPhenotype, self).__init__(**kwargs)
        self.add_children(anchor_phenotype)
        if (
            anchor_phenotype.__class__.__name__
            not in ["CodelistPhenotype", "MeasurementPhenotype"]
        ) or (
            phenotype.__class__.__name__
            not in ["CodelistPhenotype", "MeasurementPhenotype"]
        ):
            raise ValueError(
                "Both anchor_phenotype and phenotype must be of type CodelistPhenotype or MeasurementPhenotype"
            )

        self.anchor_phenotype = anchor_phenotype
        self.phenotype = phenotype
        self.column_name = column_name

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
