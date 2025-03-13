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
    transfusion_codelist: Codelist
    inpatient: CategoricalFilter
    outpatient: CategoricalFilter
    primary_diagnosis: CategoricalFilter
    secondary_diagnosis: CategoricalFilter
    diagnosis_of: CategoricalFilter = None
    diagnosis_code_domain: str = "CONDITION_OCCURRENCE_SOURCE"
    procedure_code_domain: str = "PROCEDURE_OCCURRENCE_SOURCE"
    death_domain: str = "PERSON"


def ISTHMajorBleedingPhenotype(
    components: ISTHBleedComponents,
    return_date: str = "first",
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
) -> LogicPhenotype:
    critical_organ_bleed = CriticalOrganBleedPhenotype(
        components=components,
        relative_time_range=relative_time_range,
        return_date=return_date,
    )
    symptomatic_bleed = SymptomaticBleedPhenotype(
        components=components,
        relative_time_range=relative_time_range,
        return_date=return_date,
    )
    fatal_bleed = FatalBleedPhenotype(
        components=components,
        relative_time_range=relative_time_range,
        return_date=return_date,
    )
    return LogicPhenotype(
        name="isth_major_bleed",
        expression=critical_organ_bleed | symptomatic_bleed | fatal_bleed,
        return_date=return_date,
    )


def CriticalOrganBleedPhenotype(
    components: ISTHBleedComponents,
    return_date: str = "first",
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
):
    # create required categorical filters; critical organ bleed occurs only in the inpatient position and can be either primary or secondary diagnosis position
    categorical_filters = components.inpatient & (
        components.primary_diagnosis | components.secondary_diagnosis
    )
    categorical_filters = add_diagnosis_of_filter(categorical_filters, components)

    return CodelistPhenotype(
        name="isth_critical_organ_bleed",
        domain=components.diagnosis_code_domain,
        codelist=components.critical_organ_bleed_codelist,
        categorical_filter=categorical_filters,
        relative_time_range=relative_time_range,
        return_date=component_return_date(relative_time_range),
    )


def SymptomaticBleedPhenotype(
    components: ISTHBleedComponents,
    return_date: str = "first",
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
):
    # create required categorical filters; critical organ bleed occurs only in the inpatient position and can be either primary or secondary diagnosis position
    categorical_filters = components.inpatient & (
        components.primary_diagnosis | components.secondary_diagnosis
    )
    categorical_filters = add_diagnosis_of_filter(categorical_filters, components)

    overt_bleed = CodelistPhenotype(
        name="isth_overt_bleed",
        domain=components.diagnosis_code_domain,
        codelist=components.overt_bleed_codelist,
        categorical_filter=categorical_filters,
        relative_time_range=relative_time_range,
        return_date=component_return_date(relative_time_range),
    )

    return BleedVerificationPhenotype(
        overt_bleed, components, relative_time_range=relative_time_range
    )


def component_return_date(relative_time_range):
    if relative_time_range is None:
        return "first"
    if relative_time_range.when == "after":
        return "first"
    return "last"


def FatalBleedPhenotype(
    components: ISTHBleedComponents,
    return_date: str = "first",
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
):
    death = DeathPhenotype(
        relative_time_range=relative_time_range, domain=components.death_domain
    )

    relative_45_days_prior = RelativeTimeRangeFilter(
        when="before",
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(45),
        anchor_phenotype=death,
    )

    # create required categorical filters; critical organ bleed already covers the inpatient conditions. we must only look for outpatient and primary diagnosis positions
    categorical_filters = components.outpatient & components.primary_diagnosis
    categorical_filters = add_diagnosis_of_filter(
        categorical_filters, components=components
    )

    if relative_time_range is None:
        full_relative_time_range = relative_45_days_prior
    else:
        full_relative_time_range = [relative_45_days_prior, relative_time_range]
    return CodelistPhenotype(
        name="isth_fatal_bleed",
        domain=components.diagnosis_code_domain,
        codelist=components.critical_organ_bleed_codelist,
        categorical_filter=categorical_filters,
        relative_time_range=full_relative_time_range,
        return_date=component_return_date(relative_time_range),
    )


def add_diagnosis_of_filter(categorical_filters, components):
    # if a 'diagnosis_of' (as opposed to 'history_of', etc) categorical filter is provided, add it to the list of conditions
    if components.diagnosis_of is not None:
        categorical_filters = categorical_filters & components.diagnosis_of
    return categorical_filters


def BleedVerificationPhenotype(
    anchor_phenotype,
    components: ISTHBleedComponents,
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
):

    within_two_days = RelativeTimeRangeFilter(
        when="after",
        min_days=GreaterThanOrEqualTo(-2),
        max_days=LessThanOrEqualTo(2),
        anchor_phenotype=anchor_phenotype,
    )
    if relative_time_range is not None:
        relative_time_range = [relative_time_range, within_two_days]

    transfusion = CodelistPhenotype(
        name="transfusion_two_days_within_" + anchor_phenotype.name,
        codelist=components.transfusion_codelist,
        domain=components.procedure_code_domain,
        relative_time_range=relative_time_range,
    )

    return transfusion

    # hb_drop = LabChangePhenotype()
