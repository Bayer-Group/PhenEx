from dataclasses import dataclass
from typing import Optional, Union

from phenex.codelists import Codelist
from phenex.phenotypes import CodelistPhenotype, DeathPhenotype, LogicPhenotype
from phenex.filters import (
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    LessThanOrEqualTo,
    CategoricalFilter,
)

@dataclass
class ISTHBleedComponents:
    critical_organ_bleed_codelist: Codelist
    overt_bleed_codelist: Codelist
    possible_bleed_codelist: Codelist
    inpatient: CategoricalFilter
    outpatient: CategoricalFilter
    primary_diagnosis: CategoricalFilter
    secondary_diagnosis: CategoricalFilter
    diagnosis_of: CategoricalFilter = None
    diagnosis_code_domain: str = 'CONDITION_OCCURRENCE_SOURCE'
    procedure_code_domain: str = 'PROCEDURE_OCCURRENCE_SOURCE'
    death_domain: str = 'PERSON'
    anchor_phenotype: Optional[Union[str, "Phenotype"]] = None
    when: str = 'after'

    @property
    def relative_time_range(self):
        return  RelativeTimeRangeFilter(
            when = self.when,
            anchor_phenotype = self.anchor_phenotype
        )





def ISTHMajorBleedingPhenotype(
        components: ISTHBleedComponents
) -> LogicPhenotype:
    

    # bleed_verification = BleedVerificationPhenotype()
    critical_organ_bleed = CriticalOrganBleedPhenotype(components)
    symptomatic_bleed = SymptomaticBleedPhenotype(components)
    fatal_bleed = FatalBleedPhenotype(components)
    return LogicPhenotype(
        name="isth_major_bleed",
        expression=critical_organ_bleed | symptomatic_bleed | fatal_bleed,
        return_date="first",
    )


def CriticalOrganBleedPhenotype(c:ISTHBleedComponents):
    categorical_filters = c.inpatient & (c.primary_diagnosis | c.secondary_diagnosis)
    if c.diagnosis_of is not None:
        categorical_filters = categorical_filters & c.diagnosis_of

    critical_organ_bleed = CodelistPhenotype(
        name = 'isth_critical_organ_bleed'
        domain = c.diagnosis_code_domain,
        codelist = c.critical_organ_bleed_codelist,
        categorical_filter = categorical_filters,
        relative_time_range=c.relative_time_range
    )


def SymptomaticBleedPhenotype(components:ISTHBleedComponents):
    pass


def FatalBleedPhenotype(components:ISTHBleedComponents):
    pass


def BleedVerificationPhenotype():
    transfusion = CodelistPhenotype()

    # hb_drop = LabChangePhenotype()
