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
    DATE_OF_BIRTH: Optional[str] = None
    YEAR_OF_BIRTH: Optional[str] = None
    DATE_OF_DEATH: Optional[str] = None
    SEX: Optional[str] = None
    ETHNICITY: Optional[str] = None

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
        # delete optional params from mapping
        for key in [
            "DATE_OF_BIRTH",
            "DATE_OF_DEATH",
            "YEAR_OF_BIRTH",
            "SEX",
            "ETHNICITY",
        ]:
            if getattr(self, key) is None:
                del mapping[key]
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


@dataclass
class ObservationPeriodTableMapper:
    NAME_TABLE: str = "OBSERVATION_PERIOD"
    PERSON_ID: str = "PERSON_ID"
    OBSERVATION_PERIOD_START_DATE: str = "OBSERVATION_PERIOD_START_DATE"
    OBSERVATION_PERIOD_END_DATE: str = "OBSERVATION_PERIOD_END_DATE"

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


#
# OMOP Column Mappers
#
OMOPPersonTableColumnMapper = PersonTableColumnMapper(
    NAME_TABLE="PERSON",
    PERSON_ID="PERSON_ID",
    DATE_OF_BIRTH="BIRTH_DATETIME",
    YEAR_OF_BIRTH="YEAR_OF_BIRTH",
    SEX="GENDER_CONCEPT_ID",
    ETHNICITY="ETHNICITY_CONCEPT_ID",
)

OMOPDeathTableColumnMapper = PersonTableColumnMapper(
    NAME_TABLE="DEATH", PERSON_ID="PERSON_ID", DATE_OF_DEATH="DEATH_DATE"
)

OMOPPersonTableSourceColumnMapper = PersonTableColumnMapper(
    NAME_TABLE="PERSON",
    PERSON_ID="PERSON_ID",
    DATE_OF_BIRTH="BIRTH_DATETIME",
    YEAR_OF_BIRTH="YEAR_OF_BIRTH",
    SEX="GENDER_SOURCE_VALUE",
    ETHNICITY="ETHNICITY_SOURCE_VALUE",
)

OMOPConditionOccurrenceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="CONDITION_OCCURRENCE",
    EVENT_DATE="CONDITION_START_DATE",
    CODE="CONDITION_CONCEPT_ID",
)

OMOPConditionOccurrenceSourceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="CONDITION_OCCURRENCE",
    EVENT_DATE="CONDITION_START_DATE",
    CODE="CONDITION_SOURCE_VALUE",
)

OMOPProcedureOccurrenceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="PROCEDURE_OCCURRENCE",
    EVENT_DATE="PROCEDURE_DATE",
    CODE="PROCEDURE_CONCEPT_ID",
)

OMOPProcedureOccurrenceSourceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="PROCEDURE_OCCURRENCE",
    EVENT_DATE="PROCEDURE_DATE",
    CODE="PROCEDURE_SOURCE_VALUE",
)

OMOPDrugExposureColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="DRUG_EXPOSURE",
    EVENT_DATE="DRUG_EXPOSURE_START_DATE",
    CODE="DRUG_CONCEPT_ID",
)

OMOPDrugExposureSourceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="DRUG_EXPOSURE",
    EVENT_DATE="DRUG_EXPOSURE_START_DATE",
    CODE="DRUG_SOURCE_VALUE",
)

OMOPObservationPeriodColumnMapper = ObservationPeriodTableMapper(
    NAME_TABLE="OBSERVATION_PERIOD",
    PERSON_ID="PERSON_ID",
    OBSERVATION_PERIOD_START_DATE="OBSERVATION_PERIOD_START_DATE",
    OBSERVATION_PERIOD_END_DATE="OBSERVATION_PERIOD_END_DATE",
)

OMOPColumnMappers = {
    "PERSON": OMOPPersonTableColumnMapper,
    "DEATH": OMOPDeathTableColumnMapper,
    "CONDITION_OCCURRENCE": OMOPConditionOccurrenceColumnMapper,
    "PROCEDURE_OCCURRENCE": OMOPProcedureOccurrenceColumnMapper,
    "DRUG_EXPOSURE": OMOPDrugExposureColumnMapper,
    "PERSON_SOURCE": OMOPPersonTableSourceColumnMapper,
    "CONDITION_OCCURRENCE_SOURCE": OMOPConditionOccurrenceSourceColumnMapper,
    "PROCEDURE_OCCURRENCE_SOURCE": OMOPProcedureOccurrenceSourceColumnMapper,
    "DRUG_EXPOSURE_SOURCE": OMOPDrugExposureSourceColumnMapper,
    "OBSERVATION_PERIOD": OMOPObservationPeriodColumnMapper,
}

#
# Domains
#
OMOPDomains = DomainsDictionary(**OMOPColumnMappers)


#
# Vera Column Mappers
#
VeraPersonTableColumnMapper = PersonTableColumnMapper(
    NAME_TABLE="PERSON",
    PERSON_ID="PERSON_ID",
    DATE_OF_BIRTH="BIRTH_DATETIME",
    DATE_OF_DEATH="DEATH_DATETIME",
)

VeraConditionOccurrenceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="CONDITION_OCCURRENCE",
    EVENT_DATE="CONDITION_START_DATE",
    CODE="CONDITION_CONCEPT_ID",
)

VeraProcedureOccurrenceColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="PROCEDURE_OCCURRENCE",
    EVENT_DATE="PROCEDURE_DATE",
    CODE="PROCEDURE_CONCEPT_ID",
)

VeraDrugExposureColumnMapper = CodeTableColumnMapper(
    NAME_TABLE="DRUG_EXPOSURE",
    EVENT_DATE="DRUG_EXPOSURE_START_DATE",
    CODE="DRUG_CONCEPT_ID",
)

VeraObservationPeriodColumnMapper = ObservationPeriodTableMapper(
    NAME_TABLE="OBSERVATION_PERIOD",
    PERSON_ID="PERSON_ID",
    OBSERVATION_PERIOD_START_DATE="OBSERVATION_PERIOD_START_DATE",
    OBSERVATION_PERIOD_END_DATE="OBSERVATION_PERIOD_END_DATE",
)

VeraColumnMappers = {
    "PERSON": VeraPersonTableColumnMapper,
    "CONDITION_OCCURRENCE": VeraConditionOccurrenceColumnMapper,
    "PROCEDURE_OCCURRENCE": VeraProcedureOccurrenceColumnMapper,
    "DRUG_EXPOSURE": VeraDrugExposureColumnMapper,
    "OBSERVATION_PERIOD": VeraObservationPeriodColumnMapper,
}


#
# Domains
#
VeraDomains = DomainsDictionary(**VeraColumnMappers)
