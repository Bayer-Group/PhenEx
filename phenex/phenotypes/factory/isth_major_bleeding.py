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
    
    @property
    def component_phenotype_return_date(self):
        if self.when == 'after':
            return 'first'
        return 'last'

def ISTHMajorBleedingPhenotype(
        components: ISTHBleedComponents,
        return_date : str = 'first'
) -> LogicPhenotype:
    critical_organ_bleed = CriticalOrganBleedPhenotype(components)
    symptomatic_bleed = SymptomaticBleedPhenotype(components)
    fatal_bleed = FatalBleedPhenotype(components)
    return LogicPhenotype(
        name="isth_major_bleed",
        expression=critical_organ_bleed | symptomatic_bleed | fatal_bleed,
        return_date=return_date,
    )


def CriticalOrganBleedPhenotype(c:ISTHBleedComponents):
    # create required categorical filters; critical organ bleed occurs only in the inpatient position and can be either primary or secondary diagnosis position
    categorical_filters = c.inpatient & (c.primary_diagnosis | c.secondary_diagnosis)
    categorical_filters = add_diagnosis_of_filter(categorical_filters, c)

    return CodelistPhenotype(
        name = 'isth_critical_organ_bleed',
        domain = c.diagnosis_code_domain,
        codelist = c.critical_organ_bleed_codelist,
        categorical_filter = categorical_filters,
        relative_time_range=c.relative_time_range,
        return_date=c.component_phenotype_return_date
    )


def SymptomaticBleedPhenotype(c:ISTHBleedComponents):
    # create required categorical filters; critical organ bleed occurs only in the inpatient position and can be either primary or secondary diagnosis position
    categorical_filters = c.inpatient & (c.primary_diagnosis | c.secondary_diagnosis)
    categorical_filters = add_diagnosis_of_filter(categorical_filters, c)

    overt_bleed = CodelistPhenotype(
        name = 'isth_overt_bleed',
        domain = c.diagnosis_code_domain,
        codelist = c.overt_bleed_codelist,
        categorical_filter = categorical_filters,
        relative_time_range=c.relative_time_range,
        return_date=c.component_phenotype_return_date
    )

    return BleedVerificationPhenotype(overt_bleed)



def FatalBleedPhenotype(c:ISTHBleedComponents):
    death = DeathPhenotype(relative_time_range=c.relative_time_range, domain = c.death_domain)

    relative_45_days_prior = RelativeTimeRangeFilter(
        when='before',
        min_days = GreaterThanOrEqualTo(0),
        max_days = LessThanOrEqualTo(45),
        anchor_phenotype=death
    )

    # create required categorical filters; critical organ bleed already covers the inpatient conditions. we must only look for outpatient and primary diagnosis positions
    categorical_filters = c.outpatient & c.primary_diagnosis
    categorical_filters = add_diagnosis_of_filter(categorical_filters, c)

    return CodelistPhenotype(
        name = 'isth_fatal_bleed',
        domain = c.diagnosis_code_domain,
        codelist = c.critical_organ_bleed_codelist,
        categorical_filter = categorical_filters,
        relative_time_range=c.relative_time_range & relative_45_days_prior
        return_date=c.component_phenotype_return_date
    )

def add_diagnosis_of_filter(categorical_filters, c):
    # if a 'diagnosis_of' (as opposed to 'history_of', etc) categorical filter is provided, add it to the list of conditions
    if c.diagnosis_of is not None:
        categorical_filters = categorical_filters & c.diagnosis_of 
    return categorical_filters


def BleedVerificationPhenotype(anchor_phenotype, c:ISTHBleedComponents):
    within_two_days = RelativeTimeRangeFilter(
        when='after',
        min_days = GreaterThanOrEqualTo(-2),
        max_days = LessThanOrEqualTo(2),
        anchor_phenotype=anchor_phenotype
    )
    transfusion = CodelistPhenotype(
        name = 'transfusion',
        codelist = c.transfusion_codelist,
        domain = c.procedure_domain,
        relative_time_range=anchor_phenotype
    )

    return transfusion

    # hb_drop = LabChangePhenotype()
