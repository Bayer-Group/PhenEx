from phenex.tables import PhenexPersonTable, CodeTable, PhenexObservationPeriodTable


class PersonTableForTests(PhenexPersonTable):
    NAME_TABLE = "PATIENT"
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "YEAR_OF_BIRTH": "YOB",
        "SEX": "GENDER",
    }
    JOIN_KEYS = {
        "ConditionOccurenceTableForTests": ["PERSON_ID"],
        "TestVisitDetailTable": ["PERSON_ID"],
    }


class ConditionOccurenceTableForTests(CodeTable):
    NAME_TABLE = "OBSERVATION"
    JOIN_KEYS = {
        "PersonTableForTests": ["PATID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "EVENT_DATE": "OBSDATE",
        "CODE": "MEDCODEID",
    }


class DrugExposureTableForTests(CodeTable):
    NAME_TABLE = "DRUGISSUE"
    JOIN_KEYS = {
        "PersonTableForTests": ["PATID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "EVENT_DATE": "ISSUEDATE",
        "CODE": "PRODCODEID",
    }


class ObservationPeriodTableForTests(PhenexObservationPeriodTable):
    NAME_TABLE = "PATIENT"
    JOIN_KEYS = {"PersonTableForTests": ["PATID"]}
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "START_DATE": "REGSTARTDATE",
        "END_DATE": "REGENDDATE",
    }
