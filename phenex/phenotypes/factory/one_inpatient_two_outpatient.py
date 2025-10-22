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
    name : str,
    domain : str,
    codelist : Codelist,
    relative_time_range : Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ],
    categorical_filter_inpatient : CategoricalFilter,
    categorical_filter_outpatient : CategoricalFilter,
    return_date = "all",
) -> LogicPhenotype:
    """
    OneInpatientTwoOutpatientPhenotype identifies patients who meet a combined rule:
    **at least one inpatient event OR at least two outpatient events** within a specified
    time range and domain.

    This function builds a composite phenotype by creating separate inpatient and outpatient
    subphenotypes from a shared codelist and combining them logically.

    Parameters:
        name (str): 
            Base name of the phenotype.

        domain (str): 
            The OMOP domain or table name to search for matching events (e.g., 
            `'CONDITION_OCCURRENCE'`, `'PROCEDURE_OCCURRENCE'`).

        codelist (Codelist): 
            The list of standard concept IDs or codes used to identify the condition or event.

        relative_time_range (RelativeTimeRangeFilter | None): 
            Optional filter specifying the temporal window in which events should be considered.

        categorical_filter_inpatient (CategoricalFilter | None): 
            A filter applied to inpatient events.

        categorical_filter_outpatient (CategoricalFilter | None): 
            A filter applied to outpatient events.

        return_date (str): 
            Specifies which date to return for the resulting phenotype. Common options include:
                - `"first"`: Return the earliest qualifying date.
                - `"last"`: Return the most recent qualifying date.
                - `"all"`: Return all qualifying dates.
                - `None`: Do not return a date (boolean-only phenotype).

    Returns:
        LogicPhenotype: 
            A phenotype object representing patients who have **one inpatient event** 
            OR **two or more outpatient events**.

    Logic:
        1. Creates an inpatient `CodelistPhenotype` from the provided codelist.
        2. Creates an outpatient `CodelistPhenotype` (returning all event dates).
        3. Wraps the outpatient phenotype in an `EventCountPhenotype` requiring ≥2 occurrences.
        4. Combines the inpatient and outpatient logic using a logical OR (`|`).
        5. Returns a `LogicPhenotype` representing the combined rule.

    Example:
        ```python
        from phenex.phenotypes import OneInpatientTwoOutpatientPhenotype
        from phenex.codelists import Codelist
        from phenex.filters import ValueFilter, RelativeTimeRangeFilter

        # Example: Identify patients with diabetes (ICD-10 E11 codes)
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

        result_table = diabetes_phenotype.execute(tables)
        display(result_table)
        ```

    Notes:
        - The inpatient phenotype triggers the condition immediately with ≥1 qualifying event.
        - The outpatient phenotype requires ≥2 separate qualifying occurrences to count.
        - Both event streams are filtered and combined before returning the final phenotype.
    """


    # EventCountPhenotype only filters when given a value_filter or relative_time_range.
    # If both are None, it just counts events without filtering.
    # We specify RelativeTimeRangeFilter() here to ensure filtering happens—
    # enforcing that patients must have ≥2 outpatient events.
    pt_inpatient = CodelistPhenotype(
        name=name + "_inpatient",
        codelist=codelist,
        categorical_filter=categorical_filter_inpatient,
        domain=domain,
        relative_time_range=relative_time_range,
    )

    pt_outpatient = CodelistPhenotype(
        name=name + "_outpatient",
        domain=domain,
        codelist=codelist,
        categorical_filter=categorical_filter_outpatient,
        relative_time_range=relative_time_range,
        return_date="all",
    )

    pt_outpatient_two_occurrences = EventCountPhenotype(
        phenotype=pt_outpatient,
        value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(2)),
        relative_time_range=RelativeTimeRangeFilter(),
        return_date="all",
        component_date_select="second",
    )

    pt_final = LogicPhenotype(
        name=name, expression=pt_inpatient | pt_outpatient_two_occurrences,
        return_date =  return_date
    )

    return pt_final
