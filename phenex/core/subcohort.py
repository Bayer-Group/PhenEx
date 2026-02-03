from typing import List, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.core.cohort import Cohort


class Subcohort(Cohort):
    """
    A Subcohort derives from a parent cohort and applies additional inclusion /exclusion criteria. The subcohort inherits the entry criterion, inclusion and exclusion criteria from the parent cohort but can add additional filtering criteria.

    Parameters:
        name: A descriptive name for the subcohort.
        cohort: The parent cohort from which this subcohort derives.
        inclusions: Additional phenotypes that must evaluate to True for patients to be included in the subcohort.
        exclusions: Additional phenotypes that must evaluate to False for patients to be included in the subcohort.
    """

    def __init__(
        self,
        name: str,
        cohort: "Cohort",
        inclusions: Optional[List[Phenotype]] = None,
        exclusions: Optional[List[Phenotype]] = None,
    ):
        # Initialize as a regular Cohort with Cohort index table as entry criterion
        additional_inclusions = inclusions or []
        additional_exclusions = exclusions or []
        super(Subcohort, self).__init__(
            name=name,
            entry_criterion=cohort.entry_criterion,
            inclusions=cohort.inclusions + additional_inclusions,
            exclusions=cohort.exclusions + additional_exclusions,
            data_period=cohort.data_period,
        )
        self.cohort = cohort
