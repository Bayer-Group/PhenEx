from ibis.expr.types.relations import Table

from typing import Union
import ibis
import copy


class PhenexTable:
    """
    Phenex provides certain table types on which it knows how to operate. For instance, Phenex implements a CodeTable, which is an event table containing codes. Phenex has abstracted operations for each table type. For instance, given a CodeTable, Phenex knows how to filter this table based on the presence of codes within that table. Phenex doesn't care if the code table is actually a diagnosis code table or a procedure code table or a medication code table.

    In onboarding a new data model to Phenex, the tables must be mapped into Phenex table types by subclassing the appropriate PhenexTable. When subclassing a PhenexTable, you must define:

        1. COLUMN_MAPPING: a mapping of the input table columns to the fields on the chosen PhenexTable type (e.g. 'CD' maps to 'CODE' in a CodeTable).
        2. JOIN_KEYS: if you want to use the autojoin functionality of PhenexTable, you must specify what keys to use to join pairs of tables
        3. PATHS: if you want to use the autojoin functionality of PhenexTable for more complex joins, you must specify join paths to take to get from one table to another

    Note that for each table type, there are REQUIRED_FIELDS, i.e., fields that MUST be defined for Phenex to work with such a table and KNOWN_FIELDS, i.e., fields that Phenex internally understands what to do with (there is a Phenotype that knows how to work with that field). For instance, in a PhenexPersonTable, one MUST define PERSON_ID, but DATE_OF_BIRTH is an optional field that PhenEx can process if given and transform into AGE. These are fixed for each table type and should not be overridden.
    """

    NAME_TABLE = "PHENEX_TABLE"  # name of table in the database
    JOIN_KEYS = {}  # dict: class name -> List[phenex column names]
    KNOWN_FIELDS = []  # List[phenex column names]
    DEFAULT_MAPPING = {}  # dict: input column name -> phenex column name
    PATHS = {}  # dict: table class name -> List[other table class names]
    REQUIRED_FIELDS = list(DEFAULT_MAPPING.keys())

    def __init__(self, table, name=None, column_mapping={}):
        """
        Instantiate a PhenexTable, possibly overriding NAME_TABLE and COLUMN_MAPPING.
        """

        if not isinstance(table, Table):
            raise TypeError(
                f"Cannot instantiatiate {self.__class__.__name__} from {type(table)}. Must be ibis Table."
            )

        self.NAME_TABLE = name or self.NAME_TABLE

        self.column_mapping = self._get_column_mapping(column_mapping)
        self._table = table.mutate(**self.column_mapping)

        for key in self.REQUIRED_FIELDS:
            try:
                getattr(self._table, key)
            except AttributeError:
                raise ValueError(f"Required field {key} not defined in COLUMN_MAPPING.")

        self._add_phenotype_table_relationship()

    def _add_phenotype_table_relationship(self):
        self.JOIN_KEYS["PhenotypeTable"] = ["PERSON_ID"]

    def _get_column_mapping(self, column_mapping=None):
        column_mapping = column_mapping or {}
        for key in column_mapping.keys():
            if key not in self.KNOWN_FIELDS:
                raise ValueError(
                    f"Unknown mapped field {key} --> {column_mapping[key]} for f{type(self)}."
                )
        default_mapping = copy.deepcopy(self.DEFAULT_MAPPING)
        default_mapping.update(column_mapping)
        return default_mapping

    def __getattr__(self, name):
        # pass all attributes on to underlying table
        return getattr(self._table, name)

    def __getitem__(self, key):
        return self._table[key]

    @property
    def table(self):
        return self._table

    def join(self, other: "PhenexTable", *args, domains=None, **kwargs):
        """
        The join method performs a join of PhenexTables, using autojoin functionality if Phenex is able to find the table types specified in PATHS.
        """
        if isinstance(other, Table):
            return type(self)(self.table.join(other, *args, **kwargs))

        if not isinstance(other, PhenexTable):
            raise TypeError(f"Expected a PhenexTable instance, got {type(other)}")
        if len(args):
            # if user specifies join keys and join type, simply perform join as specified
            return type(self)(self.table.join(other.table, *args, **kwargs))

        # Do an autojoin by finding a path from the left to the right table and sequentially joining as necessary
        # joined table is the sequentially joined table
        # current table is the table for the left join in the current iteration
        joined_table = current_left_table = self
        for right_table_class_name in self._find_path(other):
            # get the next right table
            right_table_search_results = [
                v
                for k, v in domains.items()
                if v.__class__.__name__ == right_table_class_name
            ]
            if len(right_table_search_results) != 1:
                raise ValueError(
                    f"Unable to find unqiue {right_table_class_name} required to join {other.__class__.__name__}"
                )
            right_table = right_table_search_results[0]
            print(
                f"\tJoining : {current_left_table.__class__.__name__} to {right_table.__class__.__name__}"
            )

            # join keys are defined by the left table; in theory should enforce symmetry
            join_keys = current_left_table.JOIN_KEYS[right_table_class_name]
            columns = list(set(joined_table.columns + right_table.columns))
            # subset columns, making sure to set type of table to the very left table (self)
            joined_table = type(self)(
                joined_table.join(right_table, join_keys, **kwargs).select(columns)
            )
            current_left_table = right_table
        return joined_table

    def mutate(self, *args, **kwargs):
        return type(self)(self.table.mutate(*args, **kwargs), name=self.NAME_TABLE)

    def _find_path(self, other):

        start_name = self.__class__.__name__
        end_name = other.__class__.__name__
        # first see if direct connection
        try:
            self.JOIN_KEYS[end_name]
            return [end_name]
        except KeyError:
            try:
                return self.PATHS[end_name] + [end_name]
            except KeyError:
                raise ValueError(
                    f"Cannot autojoin {start_name} --> {end_name}. Please specify join path in PATHS."
                )

    def filter(self, expr):
        """
        Filter the table by an Ibis Expression or using a PhenExFilter.
        """
        input_columns = self.columns
        if isinstance(expr, ibis.expr.types.Expr) or isinstance(expr, list):
            filtered_table = self.table.filter(expr)
        else:
            filtered_table = expr.filter(self)

        return type(self)(
            filtered_table.select(input_columns),
            name=self.NAME_TABLE,
            column_mapping=self.column_mapping,
        )


class PhenexPersonTable(PhenexTable):

    NAME_TABLE = "PERSON"
    JOIN_KEYS = {"CodeTable": ["PERSON_ID"], "PhenexVisitDetailTable": ["PERSON_ID"]}
    KNOWN_FIELDS = [
        "PERSON_ID",
        "DATE_OF_BIRTH",
        "YEAR_OF_BIRTH",
        "DATE_OF_DEATH",
        "SEX",
        "ETHNICITY",
    ]
    DEFAULT_MAPPING = {"PERSON_ID": "PERSON_ID"}


class EventTable(PhenexTable):

    NAME_TABLE = "EVENT"
    KNOWN_FIELDS = ["PERSON_ID", "EVENT_DATE"]
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "EVENT_DATE",
    }


class CodeTable(PhenexTable):

    NAME_TABLE = "CODE"
    RELATIONSHIPS = {
        "PhenexPersonTable": ["PERSON_ID"],
        "PhenexVisitDetailTable": ["PERSON_ID", "VISIT_DETAIL_ID"],
    }
    KNOWN_FIELDS = ["PERSON_ID", "EVENT_DATE", "CODE", "CODE_TYPE", "VISIT_DETAIL_ID"]
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "EVENT_DATE",
        "CODE": "CODE",
    }


class PhenexVisitDetailTable(PhenexTable):

    NAME_TABLE = "VISIT_DETAIL"
    RELATIONSHIPS = {
        "PhenexPersonTable": ["PERSON_ID"],
        "CodeTable": ["PERSON_ID", "VISIT_DETAIL_ID"],
    }
    KNOWN_FIELDS = [
        "PERSON_ID",
        "VISIT_DETAIL_ID",
        "VISIT_DETAIL_SOURCE_VALUE",
    ]

    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "VISIT_DETAIL_ID": "VISIT_DETAIL_ID",
        "VISIT_DETAIL_SOURCE_VALUE": "VISIT_DETAIL_SOURCE_VALUE",
    }


class PhenexIndexTable(PhenexTable):

    NAME_TABLE = "INDEX"
    JOIN_KEYS = {"CodeTable": ["PERSON_ID"], "PhenexVisitDetailTable": ["PERSON_ID"]}
    KNOWN_FIELDS = [
        "PERSON_ID",
        "INDEX_DATE",
    ]
    DEFAULT_MAPPING = {"PERSON_ID": "PERSON_ID", "INDEX_DATE": "INDEX_DATE"}


class PhenexObservationPeriodTable(PhenexTable):
    NAME_TABLE = "OBSERVATION_PERIOD"
    KNOWN_FIELDS = [
        "PERSON_ID",
        "OBSERVATION_PERIOD_START_DATE",
        "OBSERVATION_PERIOD_END_DATE",
    ]
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "OBSERVATION_PERIOD_START_DATE": "OBSERVATION_PERIOD_START_DATE",
        "OBSERVATION_PERIOD_END_DATE": "OBSERVATION_PERIOD_END_DATE",
    }


class MeasurementTable(Table):
    # These datatpyes are just used for type hinting
    pass


class PhenotypeTable(PhenexTable):
    NAME_TABLE = "PHENOTYPE"
    KNOWN_FIELDS = ["PERSON_ID", "BOOLEAN", "EVENT_DATE", "VALUE"]
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "BOOLEAN": "BOOLEAN",
        "EVENT_DATE": "EVENT_DATE",
        "VALUE": "VALUE",
    }


def is_phenex_person_table(table: PhenexTable) -> bool:
    """
    Check if given table is a person table.
    One could check one row per patient?
    """
    return set(table.columns) >= set(PhenexPersonTable.REQUIRED_FIELDS)


def is_phenex_code_table(table: PhenexTable) -> bool:
    """
    Check if given table is a code table.
    """
    return set(table.columns) >= set(CodeTable.REQUIRED_FIELDS)


def is_phenex_event_table(table: PhenexTable) -> bool:
    """
    Check if given table is a code table.
    """
    return set(table.columns) >= set(EventTable.REQUIRED_FIELDS)


def is_phenex_phenotype_table(table: PhenexTable) -> bool:
    """
    Check if given table is a code table.
    """
    return set(table.columns) >= set(PhenotypeTable.REQUIRED_FIELDS)


def is_phenex_index_table(table: PhenexTable) -> bool:
    """
    Check if given table is a code table.
    """
    return set(table.columns) >= set(PhenexIndexTable.REQUIRED_FIELDS)


PHENOTYPE_TABLE_COLUMNS = ["PERSON_ID", "BOOLEAN", "EVENT_DATE", "VALUE"]
