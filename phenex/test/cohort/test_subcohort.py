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
    Subcohort,
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


class SubcohortTestGenerator(CohortTestGenerator):
    """Base class for subcohort tests that adds subcohort testing capabilities"""

    def run_tests(self, path="phenex/test/cohort", verbose=False):
        """Override to test both cohort and subcohort"""
        self.verbose = verbose
        self.cohort = self.define_cohort()
        self.subcohort = self.define_subcohort()

        self._create_artifact_directory(self.cohort.name, path)
        self.mapped_tables = self.define_mapped_tables()
        self._write_mapped_tables()
        self._generate_output_artifacts()
        self._run_tests()

    def define_subcohort(self):
        """Define the subcohort - must be implemented by subclasses"""
        raise NotImplementedError

    def define_expected_subcohort_output(self):
        """Define expected output for subcohort - must be implemented by subclasses"""
        raise NotImplementedError

    def _generate_output_artifacts(self):
        """Override to include subcohort expected outputs"""
        self.test_infos = self.define_expected_output()
        self.subcohort_test_infos = self.define_expected_subcohort_output()

        # Generate cohort artifacts
        for test_name, df in self.test_infos.items():
            filename = test_name + ".csv"
            path = os.path.join(self.dirpaths["expected"], filename)
            df.to_csv(path, index=False, date_format=self.date_format)

        # Generate subcohort artifacts
        for test_name, df in self.subcohort_test_infos.items():
            filename = f"subcohort_{test_name}.csv"
            path = os.path.join(self.dirpaths["expected"], filename)
            df.to_csv(path, index=False, date_format=self.date_format)

        # For debugging, useful:
        #
        # self.subcohort.execute(self.mapped_tables)
        # self.subcohort.index_table.to_pandas().to_csv(
        #     os.path.join(self.dirpaths["result"], "subcohort_index.csv"), index=False
        # )
        # if self.subcohort.inclusions_table is not None:
        #     self.subcohort.inclusions_table.to_pandas().to_csv(
        #         os.path.join(self.dirpaths["result"], "subcohort_inclusions.csv"), index=False
        #     )
        # if self.subcohort.exclusions_table is not None:
        #     self.subcohort.exclusions_table.to_pandas().to_csv(
        #         os.path.join(self.dirpaths["result"], "subcohort_exclusions.csv"), index=False
        #     )

        # self.cohort.execute(self.mapped_tables)
        # self.cohort.index_table.to_pandas().to_csv(
        #     os.path.join(self.dirpaths["result"], "cohort_index.csv"), index=False
        # )
        # if self.cohort.inclusions_table is not None:
        #     self.cohort.inclusions_table.to_pandas().to_csv(
        #         os.path.join(self.dirpaths["result"], "cohort_inclusions.csv"), index=False
        #     )
        # if self.cohort.exclusions_table is not None:
        #     self.cohort.exclusions_table.to_pandas().to_csv(
        #         os.path.join(self.dirpaths["result"], "cohort_exclusions.csv"), index=False
        #     )

    def _run_tests(self):
        """Override to test both cohort and subcohort"""
        # Run parent cohort tests (which will also execute subcohorts)
        self.subcohort.execute(self.mapped_tables)

        # Test subcohort results
        if "subcohort_index" in self.subcohort_test_infos.keys():
            self._test_index_table(
                result=self.subcohort.index_table,
                expected=self.subcohort_test_infos["subcohort_index"],
            )


class SimpleSubcohortWithExclusionTestGenerator(SubcohortTestGenerator):
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
                anchor_phenotype=entry, when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_subcohort_simple_cohort_with_exclusion",
            entry_criterion=entry,
            exclusions=[e4],
        )

    def define_subcohort(self):
        # Additional exclusion: patients with drug d4 (further restricts cohort)
        additional_exclusion = CodelistPhenotype(
            name="additional_exclusion_d4",
            codelist=Codelist(["d4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Subcohort(
            name="test_subcohort_simple_cohort_with_exclusion_subcohort",
            cohort=self.cohort,
            exclusions=[additional_exclusion],
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
            {
                "name": "additional_drug",
                "values": ["d4", "d5"],
            },  # d4 for exclusion, d5 as non-exclusion
            {
                "name": "additional_drug_date",
                "values": [datetime.date(2019, 6, 1)],
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
        df_drug_additional_exposure = pd.DataFrame(
            df_allvalues[["PATID", "additional_drug", "additional_drug_date"]]
        )
        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_additional_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exposure = pd.concat(
            [
                df_drug_exposure_entry,
                df_drug_exclusion_exposure,
                df_drug_additional_exposure,
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

    def define_expected_output(self):
        # Only patients with entry=d1, no e4 exclusion, AND entry date within study period (2015-2020)
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = [
            "P0",
            "P4",
        ]  # P0 and P4 have 2020-01-01 entry dates within study period
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos

    def define_expected_subcohort_output(self):
        # P0 has d4 (additional exclusion) so excluded, P4 has d5 (no exclusion) so included
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P4"]
        test_infos = {
            "subcohort_index": df_expected_index,
        }
        return test_infos


class SimpleSubcohortWithExclusionAndStudyPeriodTestGenerator(
    SimpleSubcohortWithExclusionTestGenerator
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
                anchor_phenotype=entry, when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Cohort(
            name="test_subcohort_simple_cohort_with_exclusion_and_study_period",
            entry_criterion=entry,
            exclusions=[e4],
        )

    def define_subcohort(self):
        # Additional inclusion: patients must have had an observation in the last year
        additional_inclusion = CodelistPhenotype(
            name="recent_observation",
            codelist=Codelist(["d4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before",
                min_days=GreaterThanOrEqualTo(0),
                max_days=LessThanOrEqualTo(365),
            ),
        )

        return Subcohort(
            name="test_subcohort_simple_cohort_with_exclusion_and_study_period_subcohort",
            cohort=self.cohort,
            inclusions=[additional_inclusion],
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
            {
                "name": "additional_drug",
                "values": ["d4", "d5"],
            },  # d4 for exclusion, d5 as non-exclusion
            {
                "name": "additional_drug_date",
                "values": [datetime.date(2019, 6, 1)],
            },
        ]
        return generate_dummy_cohort_data(values)

    def define_expected_output(self):
        # Only patients with entry=d1, no e4 exclusion, AND entry date within study period (2015-2020)
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = [
            "P0",
            "P4",
        ]  # P0 and P4 have 2020-01-01 entry dates within study period
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos

    def define_expected_subcohort_output(self):
        # P0 has entry within study period and recent observation (e1)
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "subcohort_index": df_expected_index,
        }
        return test_infos


class SimpleSubcohortWithExclusionPostIndexTestGenerator(
    SimpleSubcohortWithExclusionTestGenerator
):
    """
    Same cohort as test_study_period. Here add new test data with exclusion events occurring AFTER index date (these patients should NOT be excluded)
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
                anchor_phenotype=entry, when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )
        return Cohort(
            name="test_subcohort_simple_cohort_with_exclusions_post_index",
            entry_criterion=entry,
            exclusions=[e4],
        )

    def define_subcohort(self):
        # Additional exclusion: patients with d4 after index date should be excluded
        additional_exclusion = CodelistPhenotype(
            name="post_index_d4_exclusion",
            codelist=Codelist(["d4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=self.cohort.entry_criterion,
                when="after",
                min_days=GreaterThanOrEqualTo(0),
                max_days=LessThanOrEqualTo(365),
            ),
        )

        return Subcohort(
            name="test_subcohort_simple_cohort_with_exclusions_post_index_subcohort",
            cohort=self.cohort,
            exclusions=[additional_exclusion],
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
            {
                "name": "additional_drug",
                "values": ["d4", "d5"],
            },  # d4 for exclusion, d5 as non-exclusion
            {
                "name": "additional_drug_date",
                "values": [datetime.date(2019, 6, 1)],
            },
        ]
        return generate_dummy_cohort_data(values)

    def define_expected_output(self):
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0", "P8", "P12", "P16", "P24", "P28"]
        test_infos = {
            "index": df_expected_index,
        }
        return test_infos

    def define_expected_subcohort_output(self):
        # All patients from cohort should remain in subcohort since none have post-index d4
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0", "P8", "P12", "P16", "P24", "P28"]
        test_infos = {
            "subcohort_index": df_expected_index,
        }
        return test_infos


class SimpleSubcohortWithInclusionTestGenerator(
    SimpleSubcohortWithExclusionTestGenerator
):
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
            name="test_subcohort_simple_subcohort_with_additional_inclusion",
            entry_criterion=entry,
            inclusions=[i1],
        )

    def define_subcohort(self):
        # Additional inclusion: patients must also have d4
        additional_inclusion = CodelistPhenotype(
            name="additional_inclusion_d4",
            codelist=Codelist(["d4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Subcohort(
            name="test_subcohort_simple_subcohort_with_additional_inclusion_subcohort",
            cohort=self.cohort,
            inclusions=[additional_inclusion],
        )

    def define_expected_subcohort_output(self):
        # P0 has e1 and d4, so should be included in subcohort
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "subcohort_index": df_expected_index,
        }
        return test_infos


class SimpleSubcohortWithInclusionAndExclusionTestGenerator(SubcohortTestGenerator):
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
            name="test_subcohort_simple_cohort_with_inclusions2",
            entry_criterion=entry,
            inclusions=[i1],
            exclusions=[e4],
        )

    def define_subcohort(self):
        # Additional inclusion and exclusion for subcohort
        additional_inclusion = CodelistPhenotype(
            name="subcohort_inclusion_i4",
            codelist=Codelist(["i4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        # Change exclusion to e4 (which P0 doesn't have) instead of e1
        additional_exclusion = CodelistPhenotype(
            name="subcohort_exclusion_e4",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Subcohort(
            name="test_subcohort_simple_cohort_with_inclusions2_subcohort",
            cohort=self.cohort,
            inclusions=[additional_inclusion],
            exclusions=[additional_exclusion],
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
            # Include both i1 and i4 for the same patients by having multiple inclusion records
            {"name": "inclusions_i1", "values": ["i1", "none"]},
            {
                "name": "inclusions_i1_date",
                "values": [datetime.date(2019, 4, 1)],
            },
            {"name": "inclusions_i4", "values": ["i4", "none"]},
            {
                "name": "inclusions_i4_date",
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

    def define_expected_subcohort_output(self):
        # P0 has entry=d1, i1 (cohort inclusion), i4 (subcohort inclusion), e1 (not e4)
        # P0 qualifies for both cohort and subcohort
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "subcohort_index": df_expected_index,
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
        # Handle both i1 and i4 inclusions
        df_drug_inclusion_i1 = df_allvalues[df_allvalues["inclusions_i1"] != "none"][
            ["PATID", "inclusions_i1", "inclusions_i1_date"]
        ]
        df_drug_inclusion_i1.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]

        df_drug_inclusion_i4 = df_allvalues[df_allvalues["inclusions_i4"] != "none"][
            ["PATID", "inclusions_i4", "inclusions_i4_date"]
        ]
        df_drug_inclusion_i4.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]

        df_drug_exposure_entry.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
        df_drug_exclusion_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]

        df_drug_exposure = pd.concat(
            [
                df_drug_exposure_entry,
                df_drug_inclusion_i1,
                df_drug_inclusion_i4,
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


class SimpleSubcohortWithInclusionAndExclusionSeparateTablesTestGenerator(
    SubcohortTestGenerator
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
            name="test_subcohort_simple_cohort_with_inclusions",
            entry_criterion=entry,
            inclusions=[i1],
            exclusions=[e4],
        )

    def define_subcohort(self):
        # Additional inclusion from condition occurrence and exclusion from drug exposure
        additional_inclusion = CodelistPhenotype(
            name="subcohort_condition_inclusion",
            codelist=Codelist(["i4"]).copy(use_code_type=False),
            domain="CONDITION_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        # Change exclusion to e4 instead of e1 so P0 isn't excluded
        additional_exclusion = CodelistPhenotype(
            name="subcohort_drug_exclusion",
            codelist=Codelist(["e4"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return Subcohort(
            name="test_subcohort_simple_cohort_with_inclusions_subcohort",
            cohort=self.cohort,
            inclusions=[additional_inclusion],
            exclusions=[additional_exclusion],
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
            # Include both i1 and i4 for the same patients by having multiple inclusion records
            {"name": "inclusions_i1", "values": ["i1", "none"]},
            {
                "name": "inclusions_i1_date",
                "values": [datetime.date(2019, 4, 1)],
            },
            {"name": "inclusions_i4", "values": ["i4", "none"]},
            {
                "name": "inclusions_i4_date",
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

    def define_expected_subcohort_output(self):
        # P0 needs i4 from condition occurrence and must not have e1 from drug exposure
        # Ensure P0 has both i1 and i4 from conditions and not excluded by e1
        df_expected_index = pd.DataFrame()
        df_expected_index["PERSON_ID"] = ["P0"]
        test_infos = {
            "subcohort_index": df_expected_index,
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

        # create condition occurrence table with both i1 and i4 inclusions
        df_inclusion_i1 = df_allvalues[df_allvalues["inclusions_i1"] != "none"][
            ["PATID", "inclusions_i1", "inclusions_i1_date"]
        ]
        df_inclusion_i1.columns = ["PATID", "MEDCODEID", "OBSDATE"]

        df_inclusion_i4 = df_allvalues[df_allvalues["inclusions_i4"] != "none"][
            ["PATID", "inclusions_i4", "inclusions_i4_date"]
        ]
        df_inclusion_i4.columns = ["PATID", "MEDCODEID", "OBSDATE"]

        df_inclusion = pd.concat([df_inclusion_i1, df_inclusion_i4])

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


def test_simple_subcohort_with_exclusion():
    g = SimpleSubcohortWithExclusionTestGenerator()
    g.run_tests()


def test_simple_subcohort_with_exclusion_and_study_period():
    g = SimpleSubcohortWithExclusionAndStudyPeriodTestGenerator()
    g.run_tests()


def test_simple_subcohort_with_exclusions_postindex():
    g = SimpleSubcohortWithExclusionPostIndexTestGenerator()
    g.run_tests()


def test_simple_subcohort_with_inclusions_postindex():
    g = SimpleSubcohortWithInclusionTestGenerator()
    g.run_tests()


def test_simple_subcohort_with_inclusions_and_exclusions():
    g = SimpleSubcohortWithInclusionAndExclusionTestGenerator()
    g.run_tests()


def test_simple_subcohort_with_inclusions_and_exclusion_separate_table():
    g = SimpleSubcohortWithInclusionAndExclusionSeparateTablesTestGenerator()
    g.run_tests()


if __name__ == "__main__":
    test_simple_subcohort_with_exclusion()
    test_simple_subcohort_with_exclusion_and_study_period()
    test_simple_subcohort_with_exclusions_postindex()
    test_simple_subcohort_with_inclusions_postindex()
    test_simple_subcohort_with_inclusions_and_exclusions()
    test_simple_subcohort_with_inclusions_and_exclusion_separate_table()
