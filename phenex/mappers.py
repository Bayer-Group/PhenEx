from typing import Dict
from ibis.expr.types.relations import Table

from phenex.tables import *


class DomainsDictionary:
    """
    A DomainsDictionary is used to map an entire database from an arbitrary schema to a PhenEx internal representation.

    Attributes:
        domains_dict (Dict[str, class]): A dictionary where keys are domain names and values are uninstantiated PhenexTable class objects.

    Methods:
        get_mapped_tables(con, database=None) -> Dict[str, Table]:
            Get all tables mapped to PhenEx representation using the given connection.
        set_mapped_tables(con, con, overwrite=False) -> None:
            Create a view for all mapped tables in the destination database.
    """

    def __init__(self, domains_dict):
        self.domains_dict = domains_dict

    def set_mapped_tables(self, con, overwrite=False) -> Dict[str, Table]:
        """
        Get all tables mapped to PhenEx representation using the given connection.

        If a database is not provided, the current database of the connection is used to find the tables.

        Args:
            con: The connection to the database.
            database (Optional[str]): The name of the database. Defaults to the current database of the connection.

        Returns:
            Dict[str, Table]: A dictionary where keys are domain names and values are mapped tables.
        """
        existing_tables = con.dest_connection.list_tables(
            database=con.SNOWFLAKE_DEST_DATABASE
        )
        for domain, mapper in self.domains_dict.items():
            if domain not in existing_tables or overwrite:
                t = con.get_source_table(mapper.NAME_TABLE)
                mapped_table = mapper(t).table
                con.create_view(
                    mapped_table, name_table=mapper.NAME_TABLE, overwrite=overwrite
                )

    def get_mapped_tables(self, con) -> Dict[str, PhenexTable]:
        """
        Get all tables mapped to PhenEx representation using the given connection.

        If a database is not provided, the current database of the connection is used to find the tables.

        Args:
            con: The connection to the database.
            database (Optional[str]): The name of the database. Defaults to the current database of the connection.

        Returns:
            Dict[str, PhenexTable]: A dictionary where keys are domain names and values are mapped tables.
        """
        # self.set_mapped_tables(con)
        mapped_tables = {}
        for domain, mapper in self.domains_dict.items():
            mapped_tables[domain] = mapper(con.get_source_table(mapper.NAME_TABLE))
        return mapped_tables


#
# OMOP Column Mappers
#
class OMOPPersonTable(PhenexPersonTable):
    NAME_TABLE = "PERSON"
    DEFAULT_MAPPING = {"PERSON_ID": "PERSON_ID", "DATE_OF_BIRTH": "BIRTH_DATETIME"}
    JOIN_KEYS = {
        "OMOPConditionOccurenceTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": ["PERSON_ID"],
    }


class OMOPVisitOccurrenceTable(PhenexObservationPeriodTable):
    NAME_TABLE = "VISIT_OCCURRENCE"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPConditionOccurenceTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
        "OMOPDrugExposureTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
        "OMOPVisitDetailTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "START_DATE": "VISIT_START_DATE",
        "END_DATE": "VISIT_END_DATE",
    }


class OMOPVisitDetailTable(PhenexObservationPeriodTable):
    NAME_TABLE = "VISIT_DETAIL"
    RELATIONSHIPS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "START_DATE": "VISIT_DETAIL_START_DATE",
        "END_DATE": "VISIT_DETAIL_END_DATE",
    }


class OMOPConditionOccurenceTable(CodeTable):
    NAME_TABLE = "CONDITION_OCCURRENCE"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": [
            "PERSON_ID",
            "VISIT_OCCURRENCE_ID",
        ],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "CONDITION_START_DATE",
        "CODE": "CONDITION_CONCEPT_ID",
    }


class OMOPObservationTable(MeasurementTable):
    NAME_TABLE = "OBSERVATION"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": [
            "PERSON_ID",
            "VISIT_OCCURRENCE_ID",
        ],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "OBSERVATION_DATE",
        "CODE": "OBSERVATION_CONCEPT_ID",
        "VALUE": "VALUE_AS_NUMBER",
    }


class OMOPMeasurementTable(MeasurementTable):
    NAME_TABLE = "MEASUREMENT"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": [
            "PERSON_ID",
            "VISIT_OCCURRENCE_ID",
        ],
        "OMOPVisitDetailTable": [
            "PERSON_ID",
            "VISIT_DETAIL_ID",
        ],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "MEASUREMENT_DATE",
        "CODE": "MEASUREMENT_TYPE_CONCEPT_ID",
        "VALUE": "VALUE_AS_NUMBER",
    }


class OMOPDeathTable(PhenexTable):
    NAME_TABLE = "DEATH"
    JOIN_KEYS = {"OMOPPersonTable": ["PERSON_ID"]}
    KNOWN_FIELDS = ["PERSON_ID", "DATE_OF_DEATH"]
    DEFAULT_MAPPING = {"PERSON_ID": "PERSON_ID", "DATE_OF_DEATH": "DEATH_DATE"}


class OMOPProcedureOccurrenceTable(CodeTable):
    NAME_TABLE = "PROCEDURE_OCCURRENCE"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "PROCEDURE_DATE",
        "CODE": "PROCEDURE_CONCEPT_ID",
    }


class OMOPDrugExposureTable(CodeTable):
    NAME_TABLE = "DRUG_EXPOSURE"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "DRUG_EXPOSURE_START_DATE",
        "CODE": "DRUG_CONCEPT_ID",
    }

    PATHS = {
        "OMOPVisitDetailTable": ["OMOPVisitOccurrenceTable"],
    }


class OMOPConditionOccurrenceSourceTable(CodeTable):
    NAME_TABLE = "CONDITION_OCCURRENCE"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "CONDITION_START_DATE",
        "CODE": "CONDITION_SOURCE_VALUE",
    }


class OMOPProcedureOccurrenceSourceTable(CodeTable):
    NAME_TABLE = "PROCEDURE_OCCURRENCE"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "PROCEDURE_DATE",
        "CODE": "PROCEDURE_SOURCE_VALUE",
    }


class OMOPDrugExposureSourceTable(CodeTable):
    NAME_TABLE = "DRUG_EXPOSURE"
    JOIN_KEYS = {
        "OMOPPersonTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": ["PERSON_ID", "VISIT_OCCURRENCE_ID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "DRUG_EXPOSURE_START_DATE",
        "CODE": "DRUG_SOURCE_VALUE",
    }


class OMOPPersonTableSource(PhenexPersonTable):
    NAME_TABLE = "PERSON"
    JOIN_KEYS = {
        "OMOPConditionOccurenceTable": ["PERSON_ID"],
        "OMOPVisitOccurrenceTable": ["PERSON_ID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "DATE_OF_BIRTH": "BIRTH_DATETIME",
        "YEAR_OF_BIRTH": "YEAR_OF_BIRTH",
        "SEX": "GENDER_SOURCE_VALUE",
        "ETHNICITY": "ETHNICITY_SOURCE_VALUE",
    }


class OMOPObservationPeriodTable(PhenexObservationPeriodTable):
    NAME_TABLE = "OBSERVATION_PERIOD"
    JOIN_KEYS = {"OMOPPersonTable": ["PERSON_ID"]}
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "START_DATE": "OBSERVATION_PERIOD_START_DATE",
        "END_DATE": "OBSERVATION_PERIOD_END_DATE",
    }


class OMOPConceptTable(PhenexTable):
    NAME_TABLE = "CONCEPT"
    JOIN_KEYS = {"OMOPConditionOccurenceTable": ["CONCEPT_ID", "CONDITION_CONCEPT_ID"]}
    KNOWN_FIELDS = ["CONCEPT_ID", "CONCEPT_NAME"]
    DEFAULT_MAPPING = {}


#
# Domains
#
OMOPs = {
    "PERSON": OMOPPersonTable,
    "VISIT_OCCURRENCE": OMOPVisitOccurrenceTable,
    "VISIT_DETAIL": OMOPVisitDetailTable,
    "CONDITION_OCCURRENCE": OMOPConditionOccurenceTable,
    "DEATH": OMOPDeathTable,
    "PROCEDURE_OCCURRENCE": OMOPProcedureOccurrenceTable,
    "DRUG_EXPOSURE": OMOPDrugExposureTable,
    "CONDITION_OCCURRENCE_SOURCE": OMOPConditionOccurrenceSourceTable,
    "PROCEDURE_OCCURRENCE_SOURCE": OMOPProcedureOccurrenceSourceTable,
    "DRUG_EXPOSURE_SOURCE": OMOPDrugExposureSourceTable,
    "PERSON_SOURCE": OMOPPersonTableSource,
    "OBSERVATION_PERIOD": OMOPObservationPeriodTable,
    "OBSERVATION": OMOPObservationTable,
    "MEASUREMENT": OMOPMeasurementTable,
}
OMOPDomains = DomainsDictionary(OMOPs)
