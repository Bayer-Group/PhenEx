from phenex.mappers import DomainsDictionary
from phenex.tables import PhenexPersonTable, CodeTable, PhenexObservationPeriodTable
from phenex.mappers import DomainsDictionary

class PersonTableForTests(PhenexPersonTable):
    NAME_TABLE = "PERSON"
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
    NAME_TABLE = "CONDITION_OCCURRENCE"
    JOIN_KEYS = {
        "PersonTableForTests": ["PATID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "EVENT_DATE": "OBSDATE",
        "CODE": "MEDCODEID",
    }


class DrugExposureTableForTests(CodeTable):
    NAME_TABLE = "DRUG_EXPOSURE"
    JOIN_KEYS = {
        "PersonTableForTests": ["PATID"],
    }
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "EVENT_DATE": "ISSUEDATE",
        "CODE": "PRODCODEID",
    }


class ObservationPeriodTableForTests(PhenexObservationPeriodTable):
    NAME_TABLE = "OBSERVATION_PERIOD"
    JOIN_KEYS = {"PersonTableForTests": ["PATID"]}
    DEFAULT_MAPPING = {
        "PERSON_ID": "PATID",
        "START_DATE": "REGSTARTDATE",
        "END_DATE": "REGENDDATE",
    }

TestMappersDict = {
    "PERSON": PersonTableForTests,
    "CONDITION_OCCURRENCE": ConditionOccurenceTableForTests,
    "DRUG_EXPOSURE": DrugExposureTableForTests,
    "OBSERVATION_PERIOD": ObservationPeriodTableForTests,
}
TestDomains = DomainsDictionary(TestMappersDict)
