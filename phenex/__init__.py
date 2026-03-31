# Core functionality
from .node import Node, NodeGroup

# Cohort and core classes
from .core import Cohort, Subcohort, Database, Study

from .ibis_connect import SnowflakeConnector, DuckDBConnector, PostgresConnector

# Phenotype classes - the main public API
from .phenotypes import (
    Phenotype,
    EventPhenotype,
    CodelistPhenotype,
    SmartCodelistPhenotype,
    CODETYPE_INFO,
    MeasurementPhenotype,
    MeasurementChangePhenotype,
    AgePhenotype,
    SexPhenotype,
    BinPhenotype,
    CategoricalPhenotype,
    EventCountPhenotype,
    DeathPhenotype,
    TimeRangePhenotype,
    TimeRangeCountPhenotype,
    TimeRangeDayCountPhenotype,
    TimeRangeDaysToNextRange,
    TimeShiftPhenotype,
    WithinSameEncounterPhenotype,
    UserDefinedPhenotype,
    ScorePhenotype,
    ArithmeticPhenotype,
    LogicPhenotype,
)

# Filters
from .filters import (
    CategoricalFilter,
    CodelistFilter,
    RelativeTimeRangeFilter,
    ValueFilter,
    DateFilter,
    Before,
    BeforeOrOn,
    After,
    AfterOrOn,
    Date,
    GreaterThan,
    GreaterThanOrEqualTo,
    LessThan,
    LessThanOrEqualTo,
    EqualTo,
    Value,
    TimeRangeFilter,
)

# Aggregators
from .aggregators import (
    VerticalDateAggregator,
    Nearest,
    First,
    Last,
    ValueAggregator,
    Mean,
    Median,
    Max,
    Min,
    DailyValueAggregator,
    DailyMean,
    DailyMedian,
    DailyMax,
    DailyMin,
)

# Reporting
from .reporting import (
    Reporter,
    Table1,
    Table2,
    InExCounts,
    Waterfall,
    TimeToEvent,
    CohortExplorer,
    ReportDrafter,
)

# Codelists
from .codelists import (
    Codelist,
    LocalFileCodelistFactory,
    LocalCSVCodelistFactory,
    MedConBCodelistFactory,
    MedConBCollection,
)

# Derived Tables
from .derived_tables import (
    CombineOverlappingPeriods,
    EventsToTimeRange,
    MinMaxDatesToTimeRange,
)

# Serialization utilities
from .util.serialization.json import dump, dumps, load, loads

__version__ = "v0.8.0"

__all__ = [
    # Connectors
    "SnowflakeConnector",
    "DuckDBConnector",
    "PostgresConnector",
    # Core
    "Node",
    "NodeGroup",
    "Cohort",
    "Subcohort",
    "Database",
    "Study",
    # Phenotypes
    "Phenotype",
    "EventPhenotype",
    "CodelistPhenotype",
    "SmartCodelistPhenotype",
    "CODETYPE_INFO",
    "MeasurementPhenotype",
    "MeasurementChangePhenotype",
    "AgePhenotype",
    "SexPhenotype",
    "BinPhenotype",
    "CategoricalPhenotype",
    "EventCountPhenotype",
    "DeathPhenotype",
    "TimeRangePhenotype",
    "TimeRangeCountPhenotype",
    "TimeRangeDayCountPhenotype",
    "TimeRangeDaysToNextRange",
    "TimeShiftPhenotype",
    "WithinSameEncounterPhenotype",
    "UserDefinedPhenotype",
    "ScorePhenotype",
    "ArithmeticPhenotype",
    "LogicPhenotype",
    # Filters
    "CategoricalFilter",
    "CodelistFilter",
    "RelativeTimeRangeFilter",
    "ValueFilter",
    "DateFilter",
    "Before",
    "BeforeOrOn",
    "After",
    "AfterOrOn",
    "Date",
    "GreaterThan",
    "GreaterThanOrEqualTo",
    "LessThan",
    "LessThanOrEqualTo",
    "EqualTo",
    "Value",
    "TimeRangeFilter",
    # Aggregators
    "VerticalDateAggregator",
    "Nearest",
    "First",
    "Last",
    "ValueAggregator",
    "Mean",
    "Median",
    "Max",
    "Min",
    "DailyValueAggregator",
    "DailyMean",
    "DailyMedian",
    "DailyMax",
    "DailyMin",
    # Reporting
    "Reporter",
    "Table1",
    "Table2",
    "InExCounts",
    "Waterfall",
    "TimeToEvent",
    "CohortExplorer",
    "ReportDrafter",
    # Codelists
    "Codelist",
    "LocalFileCodelistFactory",
    "LocalCSVCodelistFactory",
    "MedConBCodelistFactory",
    "MedConBCollection",
    # Derived Tables
    "CombineOverlappingPeriods",
    "EventsToTimeRange",
    "MinMaxDatesToTimeRange",
    # Serialization
    "dump",
    "dumps",
    "load",
    "loads",
]
