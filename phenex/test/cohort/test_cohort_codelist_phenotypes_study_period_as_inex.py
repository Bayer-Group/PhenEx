import datetime, os
import pandas as pd
import ibis
from phenex.test.cohort_test_generator import CohortTestGenerator
from phenex.codelists import Codelist
from phenex.phenotypes import (
    AgePhenotype,
    CategoricalPhenotype,
    CodelistPhenotype,
    Cohort,
    TimeRangePhenotype,
    SexPhenotype,
)
from phenex.filters import *
from phenex.test.cohort.test_mappings import (
    PersonTableForTests,
    DrugExposureTableForTests,
    ObservationPeriodTableForTests,
    ConditionOccurenceTableForTests,
)

from phenex.test.util.dummy.generate_dummy_cohort_data import generate_dummy_cohort_data


class SimpleCohortWithExclusionTestGenerator(CohortTestGenerator):
    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        e4 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_simple_cohort_with_exclusion",
            entry_criterion=entry,
            exclusions=[e4],
        )

    def generate_dummy_input_data(self):
        values = [
            {
                "name": "entry",
                "values": ["d1", "d4"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1)],
            },
            {"name": "prior_et_use", "values": ["e1", "e4"]},
            {
                "name": "prior_et_use_date",
                "values": [datetime.date(2019, 4, 1)],
            },
        ]

        return generate_dummy_cohort_data(values)

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID"]])
        df_person["YOB"] = 1
        df_person["GENDER"] = 1
        df_person["ACCEPTABLE"] = 1
        schema_person = {"PATID": str, "YOB": int, "GENDER": int, "ACCEPTABLE": int}
        person_table = PersonTableForTests(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )
        # create drug exposure table
        df_drug_exposure_entry = pd.DataFrame(
            df_allvalues[["PATID", "entry", "entry_date"]]
        )
        df_drug_exclusion_exposure = pd.DataFrame(
            df_allvalues[["PATID", "prior_et_use", "prior_et_use_date"]]
        )
        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exposure = pd.concat(
            [df_drug_exposure_entry, df_drug_exclusion_exposure]
        )

        schema_drug_exposure = {
            "PATID": str,
            "PRODCODEID": str,
            "ISSUEDATE": datetime.date,
        }
        drug_exposure_table = DrugExposureTableForTests(
            self.con.create_table(
                "DRUG_EXPOSURE", df_drug_exposure, schema=schema_drug_exposure
            )
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
        }

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


class SimpleCohortWithExclusionAndStudyPeriodTestGenerator(
    SimpleCohortWithExclusionTestGenerator
):
    """
    Adding a study period to our study; there are now patients with an entry event prior to the study period. Check that they are properly removed
    """

    def define_cohort(self):
        study_period = DateFilter(
            min_date=AfterOrOn(datetime.date(2015, 1, 1)),
            max_date=BeforeOrOn(datetime.date(2020, 12, 31)),
        )

        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            date_range=study_period,
        )

        e4 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_simple_cohort_with_exclusion_and_study_period",
            entry_criterion=entry,
            exclusions=[e4],
        )

    def generate_dummy_input_data(self):
        values = [
            {
                "name": "entry",
                "values": ["d1", "d4"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1), datetime.date(2010, 1, 1)],
            },
            {"name": "prior_et_use", "values": ["e1", "e4"]},
            {
                "name": "prior_et_use_date",
                "values": [datetime.date(2019, 4, 1)],
            },
        ]
        return generate_dummy_cohort_data(values)


class SimpleCohortWithExclusionPostIndexTestGenerator(
    SimpleCohortWithExclusionTestGenerator
):
    """
    Same cohort as test_study_period. Here add new test data with exclusion events occurring AFTER index date (these patients should NOT be excluded)

    | **entry** | **entry_date** | **prior_et_use** | **prior_et_use_date** | **PATID** |  |
    | --- | --- | --- | --- | --- | --- |
    | **d1** | 2020-01-01 | e1 | 2019-04-01 | P0 | COHORT : no exclusion event (e4) |
    | **d1** | 2010-01-01 | e1 | 2019-04-01 | P2 | Entry date prior to study period |
    | **d1** | 2020-01-01 | e4 | 2019-04-01 | P4 | Fulfills exclusion |
    | **d1** | 2010-01-01 | e4 | 2019-04-01 | P6 | Entry date prior to study period |
    | **d1** | 2020-01-01 | e1 | 2021-04-01 | P8 | COHORT : no exclusion event (e4) |
    | **d1** | 2010-01-01 | e1 | 2021-04-01 | P10 | Entry date prior to study period |
    | **d1** | 2020-01-01 | e4 | 2021-04-01 | P12 | COHORT : exclusion event after index |
    | **d1** | 2010-01-01 | e4 | 2021-04-01 | P14 | Entry date prior to study period |
    """

    def define_cohort(self):
        study_period = DateFilter(
            min_date=AfterOrOn(datetime.date(2015, 1, 1)),
            max_date=BeforeOrOn(datetime.date(2020, 12, 31)),
        )

        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            date_range=study_period,
        )

        e4 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )
        return Cohort(
            name="test_simple_cohort_with_exclusions_post_index",
            entry_criterion=entry,
            exclusions=[e4],
        )

    def generate_dummy_input_data(self):
        values = [
            {
                "name": "entry",
                "values": ["d1", "d4"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1), datetime.date(2010, 1, 1)],
            },
            {"name": "prior_et_use", "values": ["e1", "e4"]},
            {
                "name": "prior_et_use_date",
                "values": [datetime.date(2019, 4, 1), datetime.date(2021, 4, 1)],
            },
        ]
        return generate_dummy_cohort_data(values)

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0", "P8", "P12"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


class SimpleCohortWithInclusionTestGenerator(SimpleCohortWithExclusionTestGenerator):
    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        i1 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["e1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )
        return Cohort(
            name="test_simple_cohort_with_inclusions",
            entry_criterion=entry,
            inclusions=[i1],
        )


class SimpleCohortWithInclusionAndExclusionTestGenerator(CohortTestGenerator):
    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        i1 = CodelistPhenotype(
            name="prior_et_usage_incl",
            codelist=Codelist(["i1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        e4 = CodelistPhenotype(
            name="prior_et_usage_excl",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_simple_cohort_with_inclusions",
            entry_criterion=entry,
            inclusions=[i1],
            exclusions=[e4],
        )

    def generate_dummy_input_data(self):
        values = [
            {
                "name": "entry",
                "values": ["d1", "d4"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1), datetime.date(2010, 1, 1)],
            },
            {"name": "exclusions", "values": ["e1", "e4"]},
            {
                "name": "exclusions_date",
                "values": [datetime.date(2019, 4, 1)],
            },
            {"name": "inclusions", "values": ["i1", "i4"]},
            {
                "name": "inclusions_date",
                "values": [datetime.date(2019, 4, 1)],
            },
        ]
        return generate_dummy_cohort_data(values)

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID"]])
        df_person["YOB"] = 1
        df_person["GENDER"] = 1
        df_person["ACCEPTABLE"] = 1
        schema_person = {"PATID": str, "YOB": int, "GENDER": int, "ACCEPTABLE": int}
        person_table = PersonTableForTests(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )
        # create drug exposure table
        df_drug_exposure_entry = pd.DataFrame(
            df_allvalues[["PATID", "entry", "entry_date"]]
        )
        df_drug_inclusion_exposure = pd.DataFrame(
            df_allvalues[["PATID", "inclusions", "inclusions_date"]]
        )
        df_drug_exclusion_exposure = pd.DataFrame(
            df_allvalues[["PATID", "exclusions", "exclusions_date"]]
        )
        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_inclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exposure = pd.concat(
            [
                df_drug_exposure_entry,
                df_drug_inclusion_exposure,
                df_drug_exclusion_exposure,
            ]
        )

        schema_drug_exposure = {
            "PATID": str,
            "PRODCODEID": str,
            "ISSUEDATE": datetime.date,
        }
        drug_exposure_table = DrugExposureTableForTests(
            self.con.create_table(
                "DRUG_EXPOSURE", df_drug_exposure, schema=schema_drug_exposure
            )
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
        }


class SimpleCohortWithInclusionAndExclusionSeparateTablesTestGenerator(
    CohortTestGenerator
):
    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        i1 = CodelistPhenotype(
            name="prior_et_usage_incl",
            codelist=Codelist(["i1"]).copy(use_code_type=False),
            domain="CONDITION_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        e4 = CodelistPhenotype(
            name="prior_et_usage_excl",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_simple_cohort_with_inclusions",
            entry_criterion=entry,
            inclusions=[i1],
            exclusions=[e4],
        )

    def generate_dummy_input_data(self):
        values = [
            {
                "name": "entry",
                "values": ["d1", "d4"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1), datetime.date(2010, 1, 1)],
            },
            {"name": "exclusions", "values": ["e1", "e4"]},
            {
                "name": "exclusions_date",
                "values": [datetime.date(2019, 4, 1)],
            },
            {"name": "inclusions", "values": ["i1", "i4"]},
            {
                "name": "inclusions_date",
                "values": [datetime.date(2019, 4, 1)],
            },
        ]
        return generate_dummy_cohort_data(values)

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID"]])
        df_person["YOB"] = 1
        df_person["GENDER"] = 1
        df_person["ACCEPTABLE"] = 1
        schema_person = {"PATID": str, "YOB": int, "GENDER": int, "ACCEPTABLE": int}
        person_table = PersonTableForTests(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )
        # create drug exposure table
        df_drug_exposure_entry = pd.DataFrame(
            df_allvalues[["PATID", "entry", "entry_date"]]
        )
        df_drug_exclusion_exposure = pd.DataFrame(
            df_allvalues[["PATID", "exclusions", "exclusions_date"]]
        )
        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]

        df_drug_exposure = pd.concat(
            [df_drug_exposure_entry, df_drug_exclusion_exposure]
        )

        # create condition occurrence table
        df_inclusion = pd.DataFrame(
            df_allvalues[["PATID", "inclusions", "inclusions_date"]]
        )
        df_inclusion.columns = ["PATID", "MEDCODEID", "OBSDATE"]

        schema_drug_exposure = {
            "PATID": str,
            "PRODCODEID": str,
            "ISSUEDATE": datetime.date,
        }
        drug_exposure_table = DrugExposureTableForTests(
            self.con.create_table(
                "DRUG_EXPOSURE", df_drug_exposure, schema=schema_drug_exposure
            )
        )
        schema_condition_occurrence = {
            "PATID": str,
            "MEDCODEID": str,
            "OBSDATE": datetime.date,
        }
        condition_occurrence_table = ConditionOccurenceTableForTests(
            self.con.create_table(
                "CONDITION_OCCURRENCE", df_inclusion, schema=schema_condition_occurrence
            )
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
            "CONDITION_OCCURRENCE": condition_occurrence_table,
        }


class SimpleCohortWithContinuousCoverageInclusionTestGenerator(
    SimpleCohortWithExclusionTestGenerator
):
    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        i1 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["i1"]).copy(use_code_type=False),
            domain="CONDITION_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        e4 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_simple_cohort_with_inclusions",
            entry_criterion=entry,
            inclusions=[i1],
            exclusions=[e4],
        )

    def generate_dummy_input_data(self):
        values = [
            {
                "name": "entry",
                "values": ["d1", "d4"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1), datetime.date(2010, 1, 1)],
            },
            {"name": "exclusions", "values": ["e1", "e4"]},
            {
                "name": "exclusions_date",
                "values": [datetime.date(2019, 4, 1)],
            },
            {"name": "inclusions", "values": ["i1", "i4"]},
            {
                "name": "inclusions_date",
                "values": [datetime.date(2019, 4, 1)],
            },
        ]
        return generate_dummy_cohort_data(values)

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID"]])
        df_person["YOB"] = 1
        df_person["GENDER"] = 1
        df_person["ACCEPTABLE"] = 1
        schema_person = {"PATID": str, "YOB": int, "GENDER": int, "ACCEPTABLE": int}
        person_table = PersonTableForTests(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )
        # create drug exposure table
        df_drug_exposure_entry = pd.DataFrame(
            df_allvalues[["PATID", "entry", "entry_date"]]
        )
        df_drug_exclusion_exposure = pd.DataFrame(
            df_allvalues[["PATID", "exclusions", "exclusions_date"]]
        )
        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]

        df_drug_exposure = pd.concat(
            [df_drug_exposure_entry, df_drug_exclusion_exposure]
        )

        # create condition occurrence table
        df_inclusion = pd.DataFrame(
            df_allvalues[["PATID", "inclusions", "inclusions_date"]]
        )
        df_inclusion.columns = ["PATID", "MEDCODEID", "OBSDATE"]

        schema_drug_exposure = {
            "PATID": str,
            "PRODCODEID": str,
            "ISSUEDATE": datetime.date,
        }
        drug_exposure_table = DrugExposureTableForTests(
            self.con.create_table(
                "DRUG_EXPOSURE", df_drug_exposure, schema=schema_drug_exposure
            )
        )
        schema_condition_occurrence = {
            "PATID": str,
            "MEDCODEID": str,
            "OBSDATE": datetime.date,
        }
        condition_occurrence_table = ConditionOccurenceTableForTests(
            self.con.create_table(
                "CONDITION_OCCURRENCE", df_inclusion, schema=schema_condition_occurrence
            )
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
            "CONDITION_OCCURRENCE": condition_occurrence_table,
        }


def test_simple_cohort_with_exclusion():
    g = SimpleCohortWithExclusionTestGenerator()
    g.run_tests()


def test_simple_cohort_with_exclusion_and_study_period():
    g = SimpleCohortWithExclusionAndStudyPeriodTestGenerator()
    g.run_tests()


def test_simple_cohort_with_exclusions_postindex():
    g = SimpleCohortWithExclusionPostIndexTestGenerator()
    g.run_tests()


def test_simple_cohort_with_inclusions_postindex():
    g = SimpleCohortWithInclusionTestGenerator()
    g.run_tests()


def test_simple_cohort_with_inclusions_and_exclusions():
    g = SimpleCohortWithInclusionAndExclusionTestGenerator()
    g.run_tests()


def test_simple_cohort_with_inclusions_and_exclusion_separate_table():
    g = SimpleCohortWithInclusionAndExclusionSeparateTablesTestGenerator()
    g.run_tests()


if __name__ == "__main__":
    # test_simple_cohort_with_exclusion()
    # test_simple_cohort_with_exclusion_and_study_period()
    # test_simple_cohort_with_exclusions_postindex()
    # test_simple_cohort_with_inclusions_postindex()
    # test_simple_cohort_with_inclusions_and_exclusions()
    test_simple_cohort_with_inclusions_and_exclusion_separate_table()
