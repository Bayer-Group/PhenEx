# 1. first create a CodelistPhenotype for ‘one inpatient’, using the user provided codelist and categorical_filter_inpatient
# 2. then create a EventCountPhenotype for ‘two outpatient’
# 3. create a logic phenotype that is one_inpatient OR two_outpatient


from phenex.phenotypes import CodelistPhenotype, LogicPhenotype, EventCountPhenotype

# from phenex.filters import ValueFilter, GreaterThanOrEqualTo
# from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
# from phenex.filters.value import GreaterThanOrEqualTo
from phenex.filters import *
from phenex.filters.filter import Filter
from phenex.filters.value_filter import ValueFilter
from phenex.tables import EventTable, is_phenex_phenotype_table
from phenex.filters.value import *
from phenex.codelists.codelists import Codelist
from typing import Dict, List, Union, Optional


def OneInpatientTwoOutpatientPhenotype(
    name: str,
    domain: str,
    codelist: Codelist,
    categorical_filter_inpatient: CategoricalFilter,
    categorical_filter_outpatient: CategoricalFilter,
    relative_time_range: Optional[
        Union[RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]]
    ] = None,
    outpatient_relative_time_range: Optional[
        Union[RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]]
    ] = None,
    return_date: str = "all",
) -> LogicPhenotype:
    """
    OneInpatientTwoOutpatientPhenotype identifies patients who meet a combined rule: **at least one inpatient event OR at least two outpatient events** within a specified time range and domain.

    This function builds a composite phenotype by creating separate inpatient and outpatient subphenotypes from a shared codelist and combining them logically.

    Parameters:
        name (str): Base name of the phenotype.
        domain (str): The OMOP domain or table name to search for matching events (e.g., `'CONDITION_OCCURRENCE'`, `'PROCEDURE_OCCURRENCE'`).
        codelist (Codelist): The list of standard concept IDs or codes used to identify the condition or event.
        relative_time_range (RelativeTimeRangeFilter | None): Optional filter specifying the temporal window in which events should be considered.
        outpatient_relative_time_range (outpatient_relative_time_range | None): Optional relative time constraints applied specifically within the EventCountPhenotype that enforces ≥2 outpatient events. When None, defaults to RelativeTimeRangeFilter() so counting is constrained rather than unbounded. Provide a custom filter to control the allowable window and/or minimum separation between outpatient occurrences.
        categorical_filter_inpatient (CategoricalFilter | None): A filter applied to inpatient events.
        categorical_filter_outpatient (CategoricalFilter | None): A filter applied to outpatient events.
        return_date (str): Specifies which date to return for the resulting phenotype. Common options include:
                - `"first"`: Return the earliest qualifying date.
                - `"last"`: Return the most recent qualifying date.
                - `"all"`: Return all qualifying dates.
                - `None`: Do not return a date (boolean-only phenotype).

    Returns:
        LogicPhenotype: A phenotype object representing patients who have **one inpatient event** R **two or more outpatient events**.
    Logic overview:
        1. Defines an inpatient `CodelistPhenotype` (≥1 occurrence required).
        2. Defines an outpatient `CodelistPhenotype` (collecting all dates).
        3. Wraps the outpatient phenotype in an `EventCountPhenotype` enforcing ≥2 distinct events within the outpatient time range.
        4. Combines both components with a logical OR (`|`).
        5. Returns the combined phenotype, respecting the specified `return_date` behavior.

    Example:
        ```python
        from phenex.phenotypes import OneInpatientTwoOutpatientPhenotype
        from phenex.codelists import Codelist
        from phenex.filters import RelativeTimeRangeFilter

        # Example: Identify patients with diabetes (ICD-10 E11)
        diabetes_codes = Codelist(["E11"])
        diabetes_phenotype = OneInpatientTwoOutpatientPhenotype(
            name="diabetes",
            domain="CONDITION_OCCURRENCE",
            codelist=diabetes_codes,
            relative_time_range=RelativeTimeRangeFilter(),
            categorical_filter_inpatient="inpatient_primary_diagnosis",
            categorical_filter_outpatient="outpatient_visit",
            return_date="all"
        )

        result = diabetes_phenotype.execute(tables)
        display(result)
        ```

    Notes:
        - The inpatient component triggers on a single qualifying event.
        - The outpatient component requires two or more qualifying occurrences.
        - When no `outpatient_relative_time_range` is provided, a default bounded range is applied to prevent unbounded event counting.
    """
    pt_inpatient = CodelistPhenotype(
        name=f"{name}_inpatient",
        codelist=codelist,
        categorical_filter=categorical_filter_inpatient,
        domain=domain,
        relative_time_range=relative_time_range,
    )

    pt_outpatient = CodelistPhenotype(
        name=f"{name}_outpatient_single_event",
        domain=domain,
        codelist=codelist,
        categorical_filter=categorical_filter_outpatient,
        relative_time_range=relative_time_range,
        return_date="all",
    )
    """
    Ensure EventCountPhenotype uses a time constraint for outpatient events.
    If the caller provides a custom outpatient_relative_time_range, use it; otherwise fall back to a default.
    """
    event_count_rtr = (
        outpatient_relative_time_range
        if outpatient_relative_time_range is not None
        else RelativeTimeRangeFilter()
    )

    """EventCountPhenotype only filters when given a value_filter or relative_time_range. If both are None, it just counts events without filtering. We specify RelativeTimeRangeFilter() here to ensure filtering happens enforcing that patients must have ≥2 outpatient events.
       Expose the EventCountPhenotype's value_filter and relative_time_range keyword arguments to the user of OneInpatientTwoOutpatientPhenotype as two well named keyword arguments.
    """
    pt_outpatient_two_occurrences = EventCountPhenotype(
        name = f"{name}_outpatient_two_occurrences",
        phenotype=pt_outpatient,
        value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(2)),
        relative_time_range=event_count_rtr,
        return_date="all",
        component_date_select="second",
    )

    pt_final = LogicPhenotype(
        name=name,
        expression=pt_inpatient | pt_outpatient_two_occurrences,
        return_date=return_date,
    )

    return pt_final
