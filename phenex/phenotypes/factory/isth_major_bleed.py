from dataclasses import dataclass
from typing import Optional, Union

from phenex.codelists import Codelist
from phenex.phenotypes import (
    CodelistPhenotype,
    DeathPhenotype,
    LogicPhenotype,
    MeasurementPhenotype,
    MeasurementChangePhenotype,
)

from phenex.filters import (
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    LessThanOrEqualTo,
    CategoricalFilter,
)

from phenex.util import create_logger

logger = create_logger(__name__)


@dataclass
class ISTHBleedComponents:
    """
    Database specific components of ISTH Major Bleed. These include :


    | Type                | Number                     |
    |---------------------|----------------------------|
    | codelists           | 4                          |
    | categorical filters | 4 required, 1 optional     |
    | domains             | 3                          |

    """

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
    measurement_code_domain: str = None
    death_domain: str = "PERSON"
    hemoglobin_codelist: Optional[Codelist] = None


def ISTHMajorBleedPhenotype(
    components: ISTHBleedComponents,
    name: Optional[str] = "isth_major_bleed",
    return_date: str = "first",
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
) -> LogicPhenotype:
    """
    Operational definition for ISTH Major Bleed as defined in [*Identification of International Society on Thrombosis and Haemostasis major and clinically relevant non-major bleed events from electronic health records: a novel algorithm to enhance data utilisation from real-world sources*,  Hartenstein et. al](https://pmc.ncbi.nlm.nih.gov/articles/PMC10898215/).

    This is a database agnostic implementation. Database specific components are specified by various ISTHBleedComponents.


    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for ISTHBleedComponents for more details.
        name: Optional override of default name 'isth_major_bleed'.
        return_date: Specify whether to return the date of the first, last or all bleed events
        relative_time_range: Optional specificiation of a relative time range in which to observe bleeds. For example, 'any_time_post_index' could be constructed and passed to the ISTH bleed.
    """
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
        name=name,
        expression=critical_organ_bleed | symptomatic_bleed | fatal_bleed,
        return_date=return_date,
    )


def CriticalOrganBleedPhenotype(
    components: ISTHBleedComponents,
    return_date: str = "first",
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
    name: Optional[str] = "isth_critical_organ_bleed",
) -> CodelistPhenotype:
    """
    Operational definition for critical organ bleed subcomponent of ISTH Major Bleed as defined in [*Identification of International Society on Thrombosis and Haemostasis major and clinically relevant non-major bleed events from electronic health records: a novel algorithm to enhance data utilisation from real-world sources*,  Hartenstein et. al](https://pmc.ncbi.nlm.nih.gov/articles/PMC10898215/).

    In brief, critical organ bleeds are any bleed diagnostic event from the codelist 'critical organ bleed' occurring in the inpatient setting AND (primary OR secondary) diagnosis position.

    This is a database agnostic implementation. Database specific components are specified by various ISTHBleedComponents.

    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for ISTHBleedComponents for more details.
        name: Optional override of default name 'isth_major_bleed'.
        return_date: Specify whether to return the date of the first, last or all bleed events
        relative_time_range: Optional specificiation of a relative time range in which to observe bleeds. For example, 'any_time_post_index' could be constructed and passed to the ISTH bleed.
    """
    # create required categorical filters; critical organ bleed occurs only in the inpatient position and can be either primary or secondary diagnosis position
    categorical_filters = components.inpatient & (
        components.primary_diagnosis | components.secondary_diagnosis
    )
    categorical_filters = add_diagnosis_of_filter(categorical_filters, components)

    return CodelistPhenotype(
        name=name,
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
    name: Optional[str] = "isth_overt_bleed",
) -> "BleedVerificationPhenotype":
    """
    Operational definition for symptomatic bleeds as defined in [*Identification of International Society on Thrombosis and Haemostasis major and clinically relevant non-major bleed events from electronic health records: a novel algorithm to enhance data utilisation from real-world sources*,  Hartenstein et. al](https://pmc.ncbi.nlm.nih.gov/articles/PMC10898215/).

    In brief, symptomatic bleeds are any bleed diagnostic events from the codelist 'overt_bleed' occurring in the inpatient setting AND the primary diagnosis position AND having a blood transfusion procedure event or hemoglobin drop lab event within +/- 2 days of diagnosis event.

    This is a database agnostic implementation. Database specific components are specified by various ISTHBleedComponents.

    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for ISTHBleedComponents for more details.
        name: Optional override of default name 'isth_major_bleed'.
        return_date: Specify whether to return the date of the first, last or all bleed events
        relative_time_range: Optional specificiation of a relative time range in which to observe bleeds. For example, 'any_time_post_index' could be constructed and passed to the ISTH bleed.
    """
    # create required categorical filters; critical organ bleed occurs only in the inpatient position and can be the primary diagnosis position
    categorical_filters = components.inpatient & components.primary_diagnosis

    categorical_filters = add_diagnosis_of_filter(categorical_filters, components)

    overt_bleed = CodelistPhenotype(
        name=name,
        domain=components.diagnosis_code_domain,
        codelist=components.overt_bleed_codelist,
        categorical_filter=categorical_filters,
        relative_time_range=relative_time_range,
        return_date=component_return_date(relative_time_range),
    )

    return BleedVerificationPhenotype(
        anchor_phenotype=overt_bleed,
        components=components,
        relative_time_range=relative_time_range,
    )


def FatalBleedPhenotype(
    components: ISTHBleedComponents,
    return_date: str = "first",
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
    name: Optional[str] = "isth_fatal_bleed",
) -> CodelistPhenotype:
    """
    Operational definition for fatal bleed subcomponent of ISTH Major Bleed as defined in [*Identification of International Society on Thrombosis and Haemostasis major and clinically relevant non-major bleed events from electronic health records: a novel algorithm to enhance data utilisation from real-world sources*,  Hartenstein et. al](https://pmc.ncbi.nlm.nih.gov/articles/PMC10898215/).

    In brief, fatal bleeds are bleed diagnostic events from the codelist 'critical_organ_bleed' that occur with 45 days prior to a death event.

    This is a database agnostic implementation. Database specific components are specified by various ISTHBleedComponents.

    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for ISTHBleedComponents for more details.
        name: Optional override of default name 'isth_major_bleed'.
        return_date: Specify whether to return the date of the first, last or all bleed events
        relative_time_range: Optional specificiation of a relative time range in which to observe bleeds. For example, 'any_time_post_index' could be constructed and passed to the ISTH bleed.
    """
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
        name=name,
        domain=components.diagnosis_code_domain,
        codelist=components.critical_organ_bleed_codelist,
        categorical_filter=categorical_filters,
        relative_time_range=full_relative_time_range,
        return_date=component_return_date(relative_time_range),
    )


def BleedVerificationPhenotype(
    anchor_phenotype,
    name: Optional[str] = None,
    components: ISTHBleedComponents = None,
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
    transfusion_codelist: Optional["Codelist"] = None,
    procedure_code_domain: Optional[str] = None,
    hemoglobin_codelist: Optional["Codelist"] = None,
    measurement_code_domain: Optional[str] = None,
) -> CodelistPhenotype:
    """
    Operational definition for 'bleed verification' of ISTH Major Bleed as defined in [*Identification of International Society on Thrombosis and Haemostasis major and clinically relevant non-major bleed events from electronic health records: a novel algorithm to enhance data utilisation from real-world sources*,  Hartenstein et. al](https://pmc.ncbi.nlm.nih.gov/articles/PMC10898215/).

    In brief, bleed verification is

    This is a database agnostic implementation. Database specific components are specified by various ISTHBleedComponents.

    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for ISTHBleedComponents for more details.
        name: Optional override of default name 'isth_major_bleed'.
        anchor_phenotype: Specify whether to return the date of the first, last or all bleed events
        relative_time_range: Optional specificiation of a relative time range in which to observe bleeds. For example, 'any_time_post_index' could be constructed and passed to the ISTH bleed.
    """
    if components is not None:
        transfusion_codelist = components.transfusion_codelist
        procedure_code_domain = components.procedure_code_domain
        hemoglobin_codelist = components.hemoglobin_codelist
        measurement_code_domain = components.measurement_code_domain
    if name is None:
        name = "bleed_verification_for_" + anchor_phenotype.name

    within_two_days = RelativeTimeRangeFilter(
        when="after",
        min_days=GreaterThanOrEqualTo(-2),
        max_days=LessThanOrEqualTo(2),
        anchor_phenotype=anchor_phenotype,
    )

    if relative_time_range is not None:
        composite_relative_time_range = [relative_time_range, within_two_days]

    transfusion = BloodTransfusionPhenotype(
        anchor_phenotype=anchor_phenotype,
        name=f"{name}_blood_transfusion",
        components=components,
        relative_time_range=composite_relative_time_range,
        transfusion_codelist=transfusion_codelist,
        procedure_code_domain=procedure_code_domain,
    )

    if hemoglobin_codelist is None and measurement_code_domain is None:
        logger.info(
            "ISTH Major bleeding verification : no hemoglobing measurement codes or measurement table provided. Using procedure codes for blood transfusion only."
        )
        return transfusion
    hb_drop = HbDropPhenotype(
        anchor_phenotype=anchor_phenotype,
        name=f"{name}_hb_drop",
        components=components,
        relative_time_range=composite_relative_time_range,
        hemoglobin_codelist=hemoglobin_codelist,
        measurement_code_domain=measurement_code_domain,
    )
    logger.info(
        "ISTH Major bleeding verification : using both transfusion and hemoglobin information."
    )

    return LogicPhenotype(
        name=name,
        expression=transfusion | hb_drop,
        return_date=component_return_date(relative_time_range),
    )


def BloodTransfusionPhenotype(
    anchor_phenotype,
    name: Optional[str] = None,
    components: ISTHBleedComponents = None,
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
    transfusion_codelist: Optional["Codelist"] = None,
    procedure_code_domain: Optional[str] = None,
) -> CodelistPhenotype:
    """
    Operational definition for 'bleed verification' of ISTH Major Bleed as defined in [*Identification of International Society on Thrombosis and Haemostasis major and clinically relevant non-major bleed events from electronic health records: a novel algorithm to enhance data utilisation from real-world sources*,  Hartenstein et. al](https://pmc.ncbi.nlm.nih.gov/articles/PMC10898215/).

    In brief, bleed verification is

    This is a database agnostic implementation. Database specific components are specified by various ISTHBleedComponents.

    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for ISTHBleedComponents for more details.
        name: Optional override of default name 'isth_major_bleed'.
        anchor_phenotype: Specify whether to return the date of the first, last or all bleed events
        relative_time_range: Optional specificiation of a relative time range in which to observe bleeds. For example, 'any_time_post_index' could be constructed and passed to the ISTH bleed.
    """
    if components is not None:
        transfusion_codelist = components.transfusion_codelist
        procedure_code_domain = components.procedure_code_domain
    if name is None:
        name = "transfusion_two_days_within_" + anchor_phenotype.name

    transfusion = CodelistPhenotype(
        name=name,
        codelist=transfusion_codelist,
        domain=procedure_code_domain,
        relative_time_range=relative_time_range,
        return_date="all",
    )
    return transfusion


def HbDropPhenotype(
    anchor_phenotype,
    name: Optional[str] = None,
    components: ISTHBleedComponents = None,
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
    hemoglobin_codelist: Optional["Codelist"] = None,
    measurement_code_domain: Optional[str] = None,
) -> CodelistPhenotype:
    if components is not None:
        hemoglobin_codelist = components.hemoglobin_codelist
        measurement_code_domain = components.measurement_code_domain
    if name is None:
        name = "hb_drop_two_days_within_" + anchor_phenotype.name

    hemoglobin = MeasurementPhenotype(
        name=f"{name}_hemoglobin",
        codelist=hemoglobin_codelist,
        domain=measurement_code_domain,
        relative_time_range=relative_time_range,
    )

    hemoglobin_drop = MeasurementChangePhenotype(
        name=name,
        phenotype=hemoglobin,
        min_change=GreaterThanOrEqualTo(2),
        max_days_between=LessThanOrEqualTo(2),
        direction="decrease",
        component_date_select="second",
        return_date="all",
    )

    return hemoglobin_drop


def add_diagnosis_of_filter(categorical_filters, components):
    # if a 'diagnosis_of' (as opposed to 'history_of', etc) categorical filter is provided, add it to the list of conditions
    if components.diagnosis_of is not None:
        categorical_filters = categorical_filters & components.diagnosis_of
    return categorical_filters


def component_return_date(relative_time_range):
    if relative_time_range is None:
        return "first"
    if relative_time_range.when == "after":
        return "first"
    return "last"
