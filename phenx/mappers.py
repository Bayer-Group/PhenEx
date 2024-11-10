import copy
from typing import Optional, Dict
from dataclasses import dataclass, asdict
from ibis.expr.types.relations import Table


class DomainsDictionary:
    """
    DomainsDictionary is a class that represents a dictionary of domain to table mappers.
    It is used to map tables from an arbitrary schema to a Phen-X internal representation.
    """

    def __init__(self, **kwargs):
        self.domains_dict = kwargs

    def get_mapped_tables(self, con) -> Dict[str, Table]:
        """
        Get all tables mapped to Phen-X representation using the given connection.
        """
        mapped_tables = {}
        for domain, mapper in self.domains_dict.items():
            t = con.table(mapper.NAME_TABLE)
            mapped_tables[domain] = mapper.rename(t)
        return mapped_tables


@dataclass
class PersonTableColumnMapper:
    """
    Maps columns of a "person-like" table from an arbitrary schema to a Phen-X internal representation.
    A "person-like" table is a table that contains basic information about the patients in a database,
    generally characteristics that are time-independent (such as date of birth, race, sex at birth).
    These tables are required in the computation of PersonPhenotype's.

    Attributes:
        PERSON_ID (str): The column name for the person ID.
        DATE_OF_BIRTH (str): The column name for the date of birth.
    """

    NAME_TABLE: str = "PERSON"
    PERSON_ID: str = "PERSON_ID"
    DATE_OF_BIRTH: str = "DATE_OF_BIRTH"

    def rename(self, table: Table) -> Table:
        """
        Renames the columns of the given table according to the internal representation.

        Args:
            table (Table): The table to rename columns for.

        Returns:
            Table: The table with renamed columns.
        """
        mapping = copy.deepcopy(asdict(self))
        mapping.pop("NAME_TABLE")
        return table.rename(**mapping)


@dataclass
class CodeTableColumnMapper:
    """
    Maps columns of a code table from an arbitrary schema to an internal representation.
    A code table is a table that contains coded information about events or conditions
    related to patients, such as diagnoses, procedures, or medications. These tables
    typically include an event date, a code representing the event or condition, and
    optionally a code type.

    Attributes:
        EVENT_DATE (str): The column name for the event date.
        CODE (str): The column name for the code.
        CODE_TYPE (Optional[str]): The column name for the code type, if applicable.
        PERSON_ID (str): The column name for the person ID.
    """

    NAME_TABLE: str
    EVENT_DATE: str = "EVENT_DATE"
    CODE: str = "CODE"
    CODE_TYPE: Optional[str] = None
    PERSON_ID: str = "PERSON_ID"

    def rename(self, table: Table) -> Table:
        """
        Renames the columns of the given table according to the internal representation.

        Args:
            table (Table): The table to rename columns for.

        Returns:
            Table: The table with renamed columns.
        """
        mapping = copy.deepcopy(asdict(self))
        mapping.pop("NAME_TABLE")
        if self.CODE_TYPE is None:
            del mapping["CODE_TYPE"]
        return table.rename(**mapping)


@dataclass
class MeasurementTableColumnMapper(CodeTableColumnMapper):
    """
    Maps columns of a measurement table from an arbitrary schema to an internal representation.A measurement table is a table that contains code information associated with a numerical value, for example lab test results.

    Attributes:
        EVENT_DATE (str): The column name for the event date.
        CODE (str): The column name for the code.
        CODE_TYPE (Optional[str]): The column name for the code type, if applicable.
        PERSON_ID (str): The column name for the person ID.
        VALUE (str): The column name for the value.
    """

    VALUE: str = "VALUE"


#
# OMOP Column Mappers
#
OMOPPersonTableColumnMapper = PersonTableColumnMapper(
    NAME_TABLE="PERSON", PERSON_ID="PERSON_ID", DATE_OF_BIRTH="BIRTH_DATETIME"
)

OMOPConditionOccurrenceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="CONDITION_OCCURRENCE",
    EVENT_DATE="CONDITION_START_DATE",
    CODE="CONDITION_CONCEPT_ID",
)

OMOPProcedureOccurrenceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="PROCEDURE_OCCURRENCE",
    EVENT_DATE="PROCEDURE_DATE",
    CODE="PROCEDURE_CONCEPT_ID",
)

OMOPDrugExposureColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="DRUG_EXPOSURE",
    EVENT_DATE="DRUG_EXPOSURE_START_DATE",
    CODE="DRUG_CONCEPT_ID",
)

OMOPColumnMappers = {
    "PERSON": OMOPPersonTableColumnMapper,
    "CONDITION_OCCURRENCE": OMOPConditionOccurrenceColumnMapper,
    "PROCEDURE_OCCURRENCE": OMOPProcedureOccurrenceColumnMapper,
    "DRUG_EXPOSURE": OMOPDrugExposureColumnMapper,
}


#
# Verantos WITH SOURCE CODES
#
VerantosSourceCodeTableColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="CONDITION_OCCURRENCE",
    EVENT_DATE="CONDITION_START_DATE",
    CODE="CONDITION_SOURCE_CONCEPT_CODE",
    CODE_TYPE="CONDITION_SOURCE_VOCABULARY_ID",
)

VerantosColumnMappers = {
    "PERSON": OMOPPersonTableColumnMapper,
    "CONDITION_OCCURRENCE": OMOPConditionOccurrenceColumnMapper,
    "CONDITION_OCCURRENCE_SOURCE": VerantosSourceCodeTableColumnMapper,
    "PROCEDURE_OCCURRENCE": OMOPProcedureOccurrenceColumnMapper,
    "DRUG_EXPOSURE": OMOPDrugExposureColumnMapper,
}

#
# Optum EHR Column Mappers
#
OptumPersonTableColumnMapper = PersonTableColumnMapper(
    NAME_TABLE="PATIENT",
    PERSON_ID="PATID",
    DATE_OF_BIRTH="BIRTH_YR",
)

OptumConditionOccurrenceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="DIAGNOSIS",
    EVENT_DATE="DIAGNOSIS_DATE",
    CODE="DIAGNOSIS_CODE",
    CODE_TYPE="DIAGNOSIS_CODE_TYPE",
)

OptumProcedureOccurrenceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="PROCEDURE",
    EVENT_DATE="PROCEDURE_DATE",
    CODE="PROCEDURE_CODE",
    CODE_TYPE="PROCEDURE_CODE_TYPE",
)

OptumDrugExposureColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="RX_PRESCRIBED",
    EVENT_DATE="RXDATE",
    CODE="NDC",
    CODE_TYPE=None,
)

OptumEHRColumnMappers = {
    "PERSON": OptumPersonTableColumnMapper,
    "CONDITION_OCCURRENCE": OptumConditionOccurrenceColumnMapper,
    "PROCEDURE_OCCURRENCE": OptumProcedureOccurrenceColumnMapper,
    "DRUG_EXPOSURE": OptumDrugExposureColumnMapper,
}

#
# Domains
#
OMOPDomains = DomainsDictionary(**OMOPColumnMappers)
VerantosDomains = DomainsDictionary(**VerantosColumnMappers)
OptumEHRDomains = DomainsDictionary(**OptumEHRColumnMappers)
