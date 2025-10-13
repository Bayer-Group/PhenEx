# 1. first create a CodelistPhenotype for ‘one inpatient’, using the user provided codelist and categorical_filter_inpatient
# 2. then create a EventCountPhenotype for ‘two outpatient’
# 3. create a logic phenotype that is one_inpatient OR two_outpatient


from phenex.phenotypes import CodelistPhenotype,LogicPhenotype,EventCountPhenotype
# from phenex.filters import ValueFilter, GreaterThanOrEqualTo
# from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
# from phenex.filters.value import GreaterThanOrEqualTo
from phenex.filters import *
from phenex.filters.filter import Filter
from phenex.filters.value_filter import ValueFilter
from phenex.tables import EventTable, is_phenex_phenotype_table
from phenex.filters.value import *


def OneInpatientTwoOutpatientPhenotype(
    name,
    domain,
	codelist,
    relative_time_range,
	categorical_filter_inpatient, 
	categorical_filter_outpatient,
    return_date
) -> LogicPhenotype:
    """
    This captures patients who have either one inpatient event OR at least two outpatient events.
    """ 
    pt_inpatient = CodelistPhenotype(
        name = name + "_inpatient",
        codelist = codelist,
        categorical_filter = categorical_filter_inpatient, 
        domain= domain,
        relative_time_range = relative_time_range
        
    )

    pt_outpatient = CodelistPhenotype(
        name = name + "_outpatient",
        domain=domain,
        codelist=codelist,
        categorical_filter = categorical_filter_outpatient, 
        relative_time_range = relative_time_range,
        return_date='all'
    )


    pt_outpatient_two_occurrences = EventCountPhenotype(
        phenotype=pt_outpatient,
        value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(2)),
        relative_time_range=RelativeTimeRangeFilter(),
        return_date= "all",
        component_date_select='second'
    )
        
    pt_final = LogicPhenotype(
        name = name,
        expression = pt_inpatient | pt_outpatient_two_occurrences
    )

    return pt_final

