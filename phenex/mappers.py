import copy
from typing import Optional, Dict
from dataclasses import dataclass, asdict
from ibis.expr.types.relations import Table

from phenex.tables import *


class DomainsDictionary:
    """
    A DomainsDictionary is used to map an entire database from an arbitrary schema to a PhenEx internal representation.

    Attributes:
        domains_dict (Dict[str, ]): A dictionary where keys are domain names and values are  instances.

    Methods:
        get_mapped_tables(con, database=None) -> Dict[str, Table]:
            Get all tables mapped to PhenEx representation using the given connection.
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
        existing_tables = con.dest_connection.list_tables(database=con.SNOWFLAKE_DEST_DATABASE)
        for domain, mapper in self.domains_dict.items():
            if domain not in existing_tables or overwrite:
                t = con.source_connection.table(
                    mapper.NAME_TABLE,
                    database=con.SNOWFLAKE_SOURCE_DATABASE
                )
                mapped_table = mapper(t).table
                con.dest_connection.create_view(
                    name=mapper.NAME_TABLE,
                    database=con.SNOWFLAKE_DEST_DATABASE,
                    obj=mapped_table,
                    overwrite=overwrite
                )

    def get_mapped_tables(self, con) -> Dict[str, Table]:
        """
        Get all tables mapped to PhenEx representation using the given connection.

        If a database is not provided, the current database of the connection is used to find the tables.

        Args:
            con: The connection to the database.
            database (Optional[str]): The name of the database. Defaults to the current database of the connection.

        Returns:
            Dict[str, Table]: A dictionary where keys are domain names and values are mapped tables.
        """
        # self.set_mapped_tables(con)
        mapped_tables = {}
        for domain, mapper in self.domains_dict.items():
            mapped_tables[domain] = mapper(con.dest_connection.table(
                mapper.NAME_TABLE,
                database=con.SNOWFLAKE_DEST_DATABASE
            ))
        return mapped_tables


#
# OMOP Column Mappers
#
class OMOPPersonTable(PhenexPersonTable):
    JOIN_KEYS = {
        'OMOPConditionOccurenceTable': ['PERSON_ID'],
        'OMOPVisitDetailTable': ['PERSON_ID']
    }

class OMOPVisitDetailTable(PhenexVisitDetailTable):
    JOIN_KEYS = {
        'OMOPPersonTable': ['PERSON_ID'],
        'OMOPConditionOccurenceTable': ['PERSON_ID', 'VISIT_DETAIL_ID']
    }

class OMOPConditionOccurenceTable(CodeTable):
    NAME_TABLE = 'CONDITION_OCCURRENCE'
    JOIN_KEYS = {
        'OMOPPersonTable': ['PERSON_ID'],
        'OMOPVisitDetailTable': ['PERSON_ID', 'VISIT_DETAIL_ID'] # I changed this from EVENT_DATE
    }
    DEFAULT_MAPPING = {
        'PERSON_ID': "PERSON_ID",
        'EVENT_DATE': "CONDITION_START_DATE",
        'CODE': "CONDITION_CONCEPT_ID",
    }

#
# Domains
#
OMOPs = {
    "PERSON": OMOPPersonTable,
    "VISIT": OMOPVisitDetailTable,
    "CONDITION_OCCURRENCE": OMOPConditionOccurenceTable,
    # "DEATH": OMOPDeathTable,
    # "CONDITION_OCCURRENCE": OMOPConditionOccurrence,
    # "PROCEDURE_OCCURRENCE": OMOPProcedureOccurrence,
    # "DRUG_EXPOSURE": OMOPDrugExposure,
    # "PERSON_SOURCE": OMOPPersonTableSource,
    # "CONDITION_OCCURRENCE_SOURCE": OMOPConditionOccurrenceSource,
    # "PROCEDURE_OCCURRENCE_SOURCE": OMOPProcedureOccurrenceSource,
    # "DRUG_EXPOSURE_SOURCE": OMOPDrugExposureSource,
    # "OBSERVATION_PERIOD": OMOPObservationPeriod,
}
OMOPDomains = DomainsDictionary(OMOPs)

#
# OLD vvvvv
#
# OMOPPersonTable = PersonTable(
#     NAME_TABLE="PERSON",
#     PERSON_ID="PERSON_ID",
#     DATE_OF_BIRTH="BIRTH_DATETIME",
#     YEAR_OF_BIRTH="YEAR_OF_BIRTH",
#     SEX="GENDER_CONCEPT_ID",
#     ETHNICITY="ETHNICITY_CONCEPT_ID",
# )

# OMOPDeathTable = PersonTable(
#     NAME_TABLE="DEATH", PERSON_ID="PERSON_ID", DATE_OF_DEATH="DEATH_DATE"
# )

# OMOPPersonTableSource = PersonTable(
#     NAME_TABLE="PERSON",
#     PERSON_ID="PERSON_ID",
#     DATE_OF_BIRTH="BIRTH_DATETIME",
#     YEAR_OF_BIRTH="YEAR_OF_BIRTH",
#     SEX="GENDER_SOURCE_VALUE",
#     ETHNICITY="ETHNICITY_SOURCE_VALUE",
# )

# OMOPConditionOccurrence = CodeTable(
#     NAME_TABLE="CONDITION_OCCURRENCE",
#     EVENT_DATE="CONDITION_START_DATE",
#     CODE="CONDITION_CONCEPT_ID",
# )

# OMOPConditionOccurrenceSource = CodeTable(
#     NAME_TABLE="CONDITION_OCCURRENCE",
#     EVENT_DATE="CONDITION_START_DATE",
#     CODE="CONDITION_SOURCE_VALUE",
# )

# OMOPProcedureOccurrence = CodeTable(
#     NAME_TABLE="PROCEDURE_OCCURRENCE",
#     EVENT_DATE="PROCEDURE_DATE",
#     CODE="PROCEDURE_CONCEPT_ID",
# )

# OMOPProcedureOccurrenceSource = CodeTable(
#     NAME_TABLE="PROCEDURE_OCCURRENCE",
#     EVENT_DATE="PROCEDURE_DATE",
#     CODE="PROCEDURE_SOURCE_VALUE",
# )

# OMOPDrugExposure = CodeTable(
#     NAME_TABLE="DRUG_EXPOSURE",
#     EVENT_DATE="DRUG_EXPOSURE_START_DATE",
#     CODE="DRUG_CONCEPT_ID",
# )

# OMOPDrugExposureSource = CodeTable(
#     NAME_TABLE="DRUG_EXPOSURE",
#     EVENT_DATE="DRUG_EXPOSURE_START_DATE",
#     CODE="DRUG_SOURCE_VALUE",
# )

# OMOPObservationPeriod = PhenexObservationPeriodTable(
#     NAME_TABLE="OBSERVATION_PERIOD",
#     PERSON_ID="PERSON_ID",
#     OBSERVATION_PERIOD_START_DATE="OBSERVATION_PERIOD_START_DATE",
#     OBSERVATION_PERIOD_END_DATE="OBSERVATION_PERIOD_END_DATE",
# )
