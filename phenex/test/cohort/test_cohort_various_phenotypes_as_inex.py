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
    UserDefinedPhenotype,
)
from phenex.filters import (
    DateFilter,
    ValueFilter,
    CategoricalFilter,
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    GreaterThan,
    LessThan,
)
from phenex.test.cohort.test_mappings import (
    PersonTableForTests,
    DrugExposureTableForTests,
    ObservationPeriodTableForTests,
    ConditionOccurenceTableForTests,
)

from phenex.test.util.dummy.generate_dummy_cohort_data import generate_dummy_cohort_data


class CohortWithContinuousCoverageTestGenerator(CohortTestGenerator):
    """
    | **entry** | **entry_date** | **obs_start** | **obs_end** | **PATID** | **Comment** |
    | --- | --- | --- | --- | --- | --- |
    | **d1** | 2020-01-01 | 2018-12-30 | 2020-01-10 | P0 | COHORT |
    | **d1** | 2020-01-01 | 2019-01-03 | 2020-01-10 | P2 | obs_start <1 year prior to entry |
    | **d1** | 2020-01-01 | 2018-12-30 | 2019-12-31 | P4 | obs_end before entry_date |
    | **d1** | 2020-01-01 | 2019-01-03 | 2019-12-31 | P6 | obs_start <1 year prior to entry and obs_end before entry_date |
    """

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        cc = TimeRangePhenotype(
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(365)
            )
        )

        return Cohort(
            name="test_continuous_coverage",
            entry_criterion=entry,
            inclusions=[cc],
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
            {
                "name": "obs_start",
                "values": [datetime.date(2018, 12, 30), datetime.date(2019, 1, 3)],
            },
            {
                "name": "obs_end",
                "values": [datetime.date(2020, 1, 10), datetime.date(2019, 12, 31)],
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
        # df_drug_exclusion_exposure = pd.DataFrame(df_allvalues[["PATID", "prior_et_use", "prior_et_use_date"]])
        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        # df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        # df_drug_exposure = pd.concat([df_drug_exposure_entry, df_drug_exclusion_exposure])
        df_drug_exposure = df_drug_exposure_entry

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

        # create observation period table
        df_obs = pd.DataFrame(df_allvalues[["PATID", "obs_start", "obs_end"]])
        df_obs.columns = ["PATID", "REGSTARTDATE", "REGENDDATE"]

        schema_obs = {
            "PATID": str,
            "REGSTARTDATE": datetime.date,
            "REGENDDATE": datetime.date,
        }
        obs_table = ObservationPeriodTableForTests(
            self.con.create_table("OBSERVATION_PERIOD", df_obs, schema=schema_obs)
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
            "OBSERVATION_PERIOD": obs_table,
        }

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


class CohortWithContinuousCoverageAndExclusionTestGenerator(CohortTestGenerator):
    """
    | **PATID** | **entry** | **entry_date** | **obs_start** | **obs_end** | **prior_et_use** | **prior_et_use_date** |
    | --- | --- | --- | --- | --- | --- | --- |
    | **P0** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 |
    | **P1** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 |
    | **P2** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 |
    | **P3** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 |
    | **P4** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 |
    | **P5** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 |
    | **P6** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 |
    | **P7** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 |
    | **P8** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 |
    | **P9** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 |
    | **P10** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 |
    | **P11** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 |
    | **P12** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 |
    | **P13** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 |
    | **P14** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 |
    | **P15** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 |
    """

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        cc = TimeRangePhenotype(
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(365)
            )
        )

        e4 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        def user_defined_function(mapped_tables):
            table = mapped_tables["DRUG_EXPOSURE"]
            table = table.filter(table.PRODCODEID == "d1")
            table = table.select("PERSON_ID")
            return table

        udp = UserDefinedPhenotype(name="udp", function=user_defined_function)

        return Cohort(
            name="test_continuous_coverage_with_exclusion",
            entry_criterion=entry,
            inclusions=[cc, udp],
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
            {
                "name": "obs_start",
                "values": [datetime.date(2018, 12, 30), datetime.date(2019, 1, 3)],
            },
            {
                "name": "obs_end",
                "values": [datetime.date(2020, 1, 10), datetime.date(2019, 12, 31)],
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

        # create observation period table
        df_obs = pd.DataFrame(df_allvalues[["PATID", "obs_start", "obs_end"]])
        df_obs.columns = ["PATID", "REGSTARTDATE", "REGENDDATE"]

        schema_obs = {
            "PATID": str,
            "REGSTARTDATE": datetime.date,
            "REGENDDATE": datetime.date,
        }
        obs_table = ObservationPeriodTableForTests(
            self.con.create_table("OBSERVATION_PERIOD", df_obs, schema=schema_obs)
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
            "OBSERVATION_PERIOD": obs_table,
        }

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


class CohortWithContinuousCoverageExclusionAndAgeTestGenerator(CohortTestGenerator):
    """
    | **PATID** | **entry** | **entry_date** | **obs_start** | **obs_end** | **prior_et_use** | **prior_et_use_date** | **YOB** |
    | --- | --- | --- | --- | --- | --- | --- | --- |
    | **P0** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2000 |
    | **P1** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2000 |
    | **P2** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2000 |
    | **P3** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2000 |
    | **P4** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2000 |
    | **P5** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2000 |
    | **P6** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2000 |
    | **P7** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2000 |
    | **P8** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2000 |
    | **P9** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2000 |
    | **P10** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2000 |
    | **P11** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2000 |
    | **P12** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2000 |
    | **P13** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2000 |
    | **P14** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2000 |
    | **P15** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2000 |
    | **P16** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2010 |
    | **P17** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2010 |
    | **P18** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2010 |
    | **P19** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2010 |
    | **P20** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2010 |
    | **P21** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2010 |
    | **P22** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2010 |
    | **P23** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2010 |
    | **P24** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2010 |
    | **P25** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2010 |
    | **P26** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2010 |
    | **P27** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2010 |
    | **P28** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2010 |
    | **P29** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2010 |
    | **P30** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2010 |
    | **P31** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2010 |
    """

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        cc = TimeRangePhenotype(
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(365)
            )
        )
        agege18 = AgePhenotype(
            value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(18))
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
            name="test_continuous_coverage_age_with_exclusion",
            entry_criterion=entry,
            inclusions=[cc, agege18],
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
            {
                "name": "obs_start",
                "values": [datetime.date(2018, 12, 30), datetime.date(2019, 1, 3)],
            },
            {
                "name": "obs_end",
                "values": [datetime.date(2020, 1, 10), datetime.date(2019, 12, 31)],
            },
            {"name": "prior_et_use", "values": ["e1", "e4"]},
            {
                "name": "prior_et_use_date",
                "values": [datetime.date(2019, 4, 1)],
            },
            {"name": "YOB", "values": [2000, 2010]},
        ]

        return generate_dummy_cohort_data(values)

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID", "YOB"]])
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
        # create observation period table
        df_obs = pd.DataFrame(df_allvalues[["PATID", "obs_start", "obs_end"]])
        df_obs.columns = ["PATID", "REGSTARTDATE", "REGENDDATE"]

        schema_obs = {
            "PATID": str,
            "REGSTARTDATE": datetime.date,
            "REGENDDATE": datetime.date,
        }
        obs_table = ObservationPeriodTableForTests(
            self.con.create_table("OBSERVATION_PERIOD", df_obs, schema=schema_obs)
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
            "OBSERVATION_PERIOD": obs_table,
        }

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


class CohortWithContinuousCoverageExclusionAndAgeAsExclusionTestGenerator(
    CohortWithContinuousCoverageExclusionAndAgeTestGenerator
):
    """
    Identical output and cohort definition to CohortWithContinuousCoverageExclusionAndAgeTestGenerator however using inverse of age. Instead of inclusion age >= 18, use exclusion age<18
    """

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        cc = TimeRangePhenotype(
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(365)
            )
        )
        agel18 = AgePhenotype(value_filter=ValueFilter(max_value=LessThan(18)))

        e4 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_continuous_coverage_age_with_exclusion",
            entry_criterion=entry,
            inclusions=[cc],
            exclusions=[e4, agel18],
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
            {
                "name": "obs_start",
                "values": [datetime.date(2018, 12, 30), datetime.date(2019, 1, 3)],
            },
            {
                "name": "obs_end",
                "values": [datetime.date(2020, 1, 10), datetime.date(2019, 12, 31)],
            },
            {"name": "prior_et_use", "values": ["e1", "e4"]},
            {
                "name": "prior_et_use_date",
                "values": [datetime.date(2019, 4, 1)],
            },
            {"name": "YOB", "values": [2000, 2010]},
        ]

        return generate_dummy_cohort_data(values)


class CohortWithContinuousCoverageExclusionAgeSexTestGenerator(CohortTestGenerator):
    """
    | **PATID** | **entry** | **entry_date** | **obs_start** | **obs_end** | **prior_et_use** | **prior_et_use_date** | **YOB** | **GENDER** |
    | --- | --- | --- | --- | --- | --- | --- | --- | --- |
    | **P0** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2000 | 1 |
    | **P1** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2000 | 1 |
    | **P2** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2000 | 1 |
    | **P3** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2000 | 1 |
    | **P4** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2000 | 1 |
    | **P5** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2000 | 1 |
    | **P6** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2000 | 1 |
    | **P7** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2000 | 1 |
    | **P8** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2000 | 1 |
    | **P9** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2000 | 1 |
    | **P10** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2000 | 1 |
    | **P11** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2000 | 1 |
    | **P12** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2000 | 1 |
    | **P13** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2000 | 1 |
    | **P14** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2000 | 1 |
    | **P15** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2000 | 1 |
    | **P16** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2010 | 1 |
    | **P17** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2010 | 1 |
    | **P18** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2010 | 1 |
    | **P19** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2010 | 1 |
    | **P20** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2010 | 1 |
    | **P21** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2010 | 1 |
    | **P22** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2010 | 1 |
    | **P23** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2010 | 1 |
    | **P24** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2010 | 1 |
    | **P25** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2010 | 1 |
    | **P26** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2010 | 1 |
    | **P27** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2010 | 1 |
    | **P28** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2010 | 1 |
    | **P29** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2010 | 1 |
    | **P30** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2010 | 1 |
    | **P31** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2010 | 1 |
    | **P32** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2000 | 2 |
    | **P33** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2000 | 2 |
    | **P34** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2000 | 2 |
    | **P35** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2000 | 2 |
    | **P36** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2000 | 2 |
    | **P37** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2000 | 2 |
    | **P38** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2000 | 2 |
    | **P39** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2000 | 2 |
    | **P40** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2000 | 2 |
    | **P41** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2000 | 2 |
    | **P42** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2000 | 2 |
    | **P43** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2000 | 2 |
    | **P44** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2000 | 2 |
    | **P45** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2000 | 2 |
    | **P46** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2000 | 2 |
    | **P47** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2000 | 2 |
    | **P48** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2010 | 2 |
    | **P49** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 | 2010 | 2 |
    | **P50** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2010 | 2 |
    | **P51** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 | 2010 | 2 |
    | **P52** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2010 | 2 |
    | **P53** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 | 2010 | 2 |
    | **P54** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2010 | 2 |
    | **P55** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 | 2010 | 2 |
    | **P56** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2010 | 2 |
    | **P57** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 | 2010 | 2 |
    | **P58** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2010 | 2 |
    | **P59** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 | 2010 | 2 |
    | **P60** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2010 | 2 |
    | **P61** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 | 2010 | 2 |
    | **P62** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2010 | 2 |
    | **P63** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 | 2010 | 2 |
    """

    def define_cohort(self):
        entry = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        cc = TimeRangePhenotype(
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(365)
            )
        )
        agege18 = AgePhenotype(
            value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(18))
        )
        sex = SexPhenotype(categorical_filter=CategoricalFilter(allowed_values=[1]))

        e4 = CodelistPhenotype(
            name="prior_et_usage",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_continuous_coverage_age_sex_with_exclusion",
            entry_criterion=entry,
            inclusions=[cc, agege18, sex],
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
            {
                "name": "obs_start",
                "values": [datetime.date(2018, 12, 30), datetime.date(2019, 1, 3)],
            },
            {
                "name": "obs_end",
                "values": [datetime.date(2020, 1, 10), datetime.date(2019, 12, 31)],
            },
            {"name": "prior_et_use", "values": ["e1", "e4"]},
            {
                "name": "prior_et_use_date",
                "values": [datetime.date(2019, 4, 1)],
            },
            {"name": "YOB", "values": [2000, 2010]},
            {"name": "GENDER", "values": [1, 2]},
        ]

        return generate_dummy_cohort_data(values)

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID", "YOB", "GENDER"]])
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
        # create observation period table
        df_obs = pd.DataFrame(df_allvalues[["PATID", "obs_start", "obs_end"]])
        df_obs.columns = ["PATID", "REGSTARTDATE", "REGENDDATE"]

        schema_obs = {
            "PATID": str,
            "REGSTARTDATE": datetime.date,
            "REGENDDATE": datetime.date,
        }
        obs_table = ObservationPeriodTableForTests(
            self.con.create_table("OBSERVATION_PERIOD", df_obs, schema=schema_obs)
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
            "OBSERVATION_PERIOD": obs_table,
        }

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


class CohortWithUDPTestGenerator(CohortTestGenerator):
    """
    | **PATID** | **entry** | **entry_date** | **obs_start** | **obs_end** | **prior_et_use** | **prior_et_use_date** |
    | --- | --- | --- | --- | --- | --- | --- |
    | **P0** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 |
    | **P1** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e1 | 2019-04-01 |
    | **P2** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 |
    | **P3** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e1 | 2019-04-01 |
    | **P4** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 |
    | **P5** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e1 | 2019-04-01 |
    | **P6** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 |
    | **P7** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e1 | 2019-04-01 |
    | **P8** | d1 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 |
    | **P9** | d4 | 2020-01-01 | 2018-12-30 | 2020-01-10 | e4 | 2019-04-01 |
    | **P10** | d1 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 |
    | **P11** | d4 | 2020-01-01 | 2019-01-03 | 2020-01-10 | e4 | 2019-04-01 |
    | **P12** | d1 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 |
    | **P13** | d4 | 2020-01-01 | 2018-12-30 | 2019-12-31 | e4 | 2019-04-01 |
    | **P14** | d1 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 |
    | **P15** | d4 | 2020-01-01 | 2019-01-03 | 2019-12-31 | e4 | 2019-04-01 |
    """

    def define_cohort(self):
        def user_defined_function(mapped_tables):
            df = pd.DataFrame()
            df["PERSON_ID"] = ["P0", "P1", "P2", "P3", "P4"]
            df["EVENT_DATE"] = [
                datetime.date(2020, 1, 1),  # d1 give correct cc
                datetime.date(2020, 1, 1),
                datetime.date(2020, 1, 3),  # d1 give correct cc
                datetime.date(2020, 1, 1),
                datetime.date(2018, 1, 1),  # d1 give incorrect cc
            ]
            return ibis.memtable(df)

        entry = UserDefinedPhenotype(name="udp", function=user_defined_function)

        d1 = CodelistPhenotype(
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        cc = TimeRangePhenotype(
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(30)
            )
        )

        return Cohort(
            name="test_udp_entry",
            entry_criterion=entry,
            inclusions=[cc, d1],
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
            {
                "name": "obs_start",
                "values": [datetime.date(2018, 12, 30), datetime.date(2019, 1, 3)],
            },
            {
                "name": "obs_end",
                "values": [datetime.date(2020, 1, 10), datetime.date(2019, 12, 31)],
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

        # create observation period table
        df_obs = pd.DataFrame(df_allvalues[["PATID", "obs_start", "obs_end"]])
        df_obs.columns = ["PATID", "REGSTARTDATE", "REGENDDATE"]

        schema_obs = {
            "PATID": str,
            "REGSTARTDATE": datetime.date,
            "REGENDDATE": datetime.date,
        }
        obs_table = ObservationPeriodTableForTests(
            self.con.create_table("OBSERVATION_PERIOD", df_obs, schema=schema_obs)
        )
        return {
            "PERSON": person_table,
            "DRUG_EXPOSURE": drug_exposure_table,
            "OBSERVATION_PERIOD": obs_table,
        }

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0", "P2"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos


def test_time_range_phenotype():
    g = CohortWithContinuousCoverageTestGenerator()
    g.run_tests()


def test_continuous_coverage_with_exclusion():
    g = CohortWithContinuousCoverageAndExclusionTestGenerator()
    g.run_tests()


def test_continuous_coverage_age_with_exclusion():
    g = CohortWithContinuousCoverageExclusionAndAgeTestGenerator()
    g.run_tests()


def test_continuous_coverage_age_as_exclusion_with_exclusion():
    g = CohortWithContinuousCoverageExclusionAndAgeAsExclusionTestGenerator()
    g.run_tests()


def test_continuous_coverage_age_sex_with_exclusion():
    g = CohortWithContinuousCoverageExclusionAgeSexTestGenerator()
    g.run_tests()


def test_udp_entry():
    g = CohortWithUDPTestGenerator()
    g.run_tests()


if __name__ == "__main__":
    test_udp_entry()
