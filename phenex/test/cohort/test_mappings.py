from phenex.tables import PhenexPersonTable, CodeTable, PhenexObservationPeriodTable

class TestPersonTable(PhenexPersonTable):
    NAME_TABLE = "PATIENT"
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "YEAR_OF_BIRTH": "YOB",
        "SEX": "GENDER",
    }
    JOIN_KEYS = {
        "TestConditionOccurenceTable": ["PERSON_ID"],
        "TestVisitDetailTable": ["PERSON_ID"],
    }


class TestConditionOccurenceTable(CodeTable):
    NAME_TABLE = "OBSERVATION"
    JOIN_KEYS = {
        "TestPersonTable": ["PATID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "EVENT_DATE": "OBSDATE",
        "CODE": "MEDCODEID",
    }


class TestDrugExposureTable(CodeTable):
    NAME_TABLE = "DRUGISSUE"
    JOIN_KEYS = {
        "TestPersonTable": ["PATID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "EVENT_DATE": "ISSUEDATE",
        "CODE": "PRODCODEID",
    }


class TestObservationPeriodTable(PhenexObservationPeriodTable):
    NAME_TABLE = "PATIENT"
    JOIN_KEYS = {"TestPersonTable": ["PATID"]}
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "OBSERVATION_PERIOD_START_DATE": "REGSTARTDATE",
        "OBSERVATION_PERIOD_END_DATE": "REGENDDATE",
    }