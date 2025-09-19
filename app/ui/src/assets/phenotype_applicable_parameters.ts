export const columnNameToApplicablePhenotypeMapping = {
    "return_date": [
        "CategoricalPhenotype",
        "CodelistPhenotype",
        "EventCountPhenotype",
        "MeasurementChangePhenotype",
        "MeasurementPhenotype",
        "ScorePhenotype",
        "ArithmeticPhenotype",
        "LogicPhenotype"
    ],
    "domain": [
        "AgePhenotype",
        "CategoricalPhenotype",
        "CodelistPhenotype",
        "DeathPhenotype",
        "MeasurementPhenotype",
        "TimeRangePhenotype"
    ],
    "relative_time_range": [
        "CategoricalPhenotype",
        "CodelistPhenotype",
        "DeathPhenotype",
        "EventCountPhenotype",
        "MeasurementPhenotype",
        "TimeRangePhenotype"
    ],
    "phenotype": [
        "BinPhenotype",
        "EventCountPhenotype",
        "MeasurementChangePhenotype",
        "WithinSameEncounterPhenotype"
    ],
    "value_filter": [
        "AgePhenotype",
        "EventCountPhenotype",
        "MeasurementPhenotype"
    ],
    "categorical_filter": [
        "CategoricalPhenotype",
        "CodelistPhenotype",
        "MeasurementPhenotype"
    ],
    "date_range": [
        "CategoricalPhenotype",
        "CodelistPhenotype",
        "MeasurementPhenotype"
    ],
    "expression": [
        "ScorePhenotype",
        "ArithmeticPhenotype",
        "LogicPhenotype"
    ],
    "anchor_phenotype": [
        "AgePhenotype",
        "WithinSameEncounterPhenotype"
    ],
    "codelist": [
        "CodelistPhenotype",
        "MeasurementPhenotype"
    ],
    "bins": [
        "BinPhenotype"
    ],
    "return_event": [
        "EventCountPhenotype"
    ],
    "min_change": [
        "MeasurementChangePhenotype"
    ],
    "max_change": [
        "MeasurementChangePhenotype"
    ],
    "direction": [
        "MeasurementChangePhenotype"
    ],
    "min_days_between": [
        "MeasurementChangePhenotype"
    ],
    "max_days_between": [
        "MeasurementChangePhenotype"
    ],
    "component_date_select": [
        "MeasurementChangePhenotype"
    ],
    "return_value": [
        "MeasurementChangePhenotype"
    ],
    "clean_nonphysiologicals_value_filter": [
        "MeasurementPhenotype"
    ],
    "clean_null_values": [
        "MeasurementPhenotype"
    ],
    "value_aggregation": [
        "MeasurementPhenotype"
    ],
    "further_value_filter_phenotype": [
        "MeasurementPhenotype"
    ],
    "allow_null_end_date": [
        "TimeRangePhenotype"
    ],
    "function": [
        "UserDefinedPhenotype"
    ],
    "column_name": [
        "WithinSameEncounterPhenotype"
    ]
}