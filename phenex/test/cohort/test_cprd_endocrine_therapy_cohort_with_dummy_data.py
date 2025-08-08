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
from phenex.tables import PhenexPersonTable, CodeTable, PhenexObservationPeriodTable
from phenex.test.cohort.test_mappings import (
    PersonTableForTests,
    DrugExposureTableForTests,
    ObservationPeriodTableForTests,
    ConditionOccurenceTableForTests,
)


def create_cohort():
    """
    ## DEMO STUDY DEFINITION
    INCLUSION CRITERIA
        * Female patient
        * Aged ≥18 as of the index date
        * Registered in CPRD at least 365 days prior to the index date
        *  At least one drug exposure to ET, defined as a prescription for tamoxifen, aromatase inhibitors (AIs), or gonadotropin releasing hormone (GnRH) antagonists  between 1 January 2010 through 31 December 2020.
    The date of the first ET prescription in this time period is the index date.
    AIs will include: aminoglutethimide, formestane, anastrozole, letrozole, vorozole, exemestane
    GnRH agonists will include: buserelin, leuprorelin/leuprolide, goserelin, triptorelin, histrelin, leuprorelin and bicalutamide, gonadorelin, nafarelin, ganirelix, cetrorelix, elagolix, linzagolix, relugolix, estradiol and norethisterone, degarelix, abarelix
        * BC diagnosis at any time prior to ET prescription in the baseline period
        * Permanently registered acceptable patient

    EXCLUSION CRITERIA
    Any prescription for tamoxifen or AIs before the BC diagnosis date (prevalent users)
    """
    study_period = DateFilter(
        min_date=AfterOrOn(datetime.date(2010, 1, 1)),
        max_date=BeforeOrOn(datetime.date(2020, 12, 31)),
    )

    entry = CodelistPhenotype(
        name="codelist_drugs",
        return_date="first",
        codelist=Codelist(["d1"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
        date_range=study_period,
    )

    inclusion, exclusion = define_inclusion_exclusion_criteria(entry)

    cohort = Cohort(
        name="bc",
        entry_criterion=entry,
        inclusions=inclusion,
        exclusions=exclusion,
    )

    return cohort


def define_inclusion_exclusion_criteria(entry):
    continuous_coverage = TimeRangePhenotype(
        relative_time_range=RelativeTimeRangeFilter(
            min_days=GreaterThanOrEqualTo(365), anchor_phenotype=entry
        )
    )

    age_18 = AgePhenotype(
        value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(18)),
        anchor_phenotype=entry,
    )

    sex = SexPhenotype(categorical_filter=CategoricalFilter(allowed_values=[2]))

    quality = CategoricalPhenotype(
        domain="PERSON",
        name="data_quality",
        categorical_filter=CategoricalFilter(
            allowed_values=[1],
            column_name="ACCEPTABLE",
        ),
    )

    breast_cancer = CodelistPhenotype(
        name="breast_cancer",
        codelist=Codelist(["b1"]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
        return_date="first",
        relative_time_range=RelativeTimeRangeFilter(
            when="before", min_days=GreaterThan(0), anchor_phenotype=entry
        ),
    )

    inclusion_criteria = [breast_cancer, continuous_coverage, quality, age_18, sex]

    tamoxifen = CodelistPhenotype(
        name="prior_et_usage",
        codelist=Codelist(["d4", "d5", "d6"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
        relative_time_range=RelativeTimeRangeFilter(
            anchor_phenotype=breast_cancer,
            when="before",
            min_days=GreaterThan(0),
        ),
    )

    exclusion_criteria = []  # [tamoxifen]

    return inclusion_criteria, exclusion_criteria


class SimpleCohortTestGenerator(CohortTestGenerator):
    def define_cohort(self):
        return create_cohort()

    def define_mapped_tables(self):
        self.con = ibis.duckdb.connect()
        df_allvalues = create_test_data()

        # create dummy person table
        df_person = pd.DataFrame(df_allvalues[["PATID", "YOB", "GENDER", "ACCEPTABLE"]])
        schema_person = {"PATID": str, "YOB": int, "GENDER": int, "ACCEPTABLE": int}
        person_table = PersonTableForTests(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )

        # create dummy observation period table
        df_observation = pd.DataFrame(df_allvalues[["PATID", "REGSTARTDATE"]])
        df_observation["REGENDDATE"] = datetime.date(2020, 10, 10)
        schema_observation = {
            "PATID": str,
            "REGSTARTDATE": datetime.date,
            "REGENDDATE": datetime.date,
        }
        observation_period_table = ObservationPeriodTableForTests(
            self.con.create_table(
                "OBSERVATION_PERIOD", df_observation, schema=schema_observation
            )
        )

        # create dummy condition occurrence table
        df_condition_occurrence = pd.DataFrame(
            df_allvalues[["PATID", "breast_cancer_code", "breast_cancer_date"]]
        )
        df_condition_occurrence.columns = ["PATID", "MEDCODEID", "OBSDATE"]
        schema_condition_occurrence = {
            "PATID": str,
            "MEDCODEID": str,
            "OBSDATE": datetime.date,
        }
        condition_occurrence_table = ConditionOccurenceTableForTests(
            self.con.create_table(
                "CONDITION_OCCURRENCE",
                df_condition_occurrence,
                schema=schema_condition_occurrence,
            )
        )

        # create drug exposure table
        df_drug_exposure = pd.DataFrame(df_allvalues[["PATID", "entry", "entry_date"]])
        df_drug_exposure.columns = ["PATID", "PRODCODEID", "ISSUEDATE"]
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
            "CONDITION_OCCURRENCE": condition_occurrence_table,
            "DRUG_EXPOSURE": drug_exposure_table,
            "OBSERVATION_PERIOD": observation_period_table,
        }

    def define_expected_output(self):
        df_counts_inclusion = pd.DataFrame()
        df_counts_inclusion["phenotype"] = [
            x.upper()
            for x in [
                "breast_cancer",
                "time_range",
                "data_quality",
                "age",
                "sex",
            ]
        ]
        df_counts_inclusion["n"] = [16, 32, 32, 32, 32]

        df_counts_exclusion = pd.DataFrame()
        df_counts_exclusion["phenotype"] = ["prior_et_usage"]
        df_counts_exclusion["n"] = [0]

        test_infos = {
            "counts_inclusion": df_counts_inclusion,
            "counts_exclusion": df_counts_exclusion,
        }
        return test_infos


def create_test_data():
    # this is a list of all the parameters i want every possible combination of
    inclusion = [
        {
            "name": "entry",
            "values": ["d1", "d4"],
        },  # the first value is the allowed value, the second is the not allowed value
        {
            "name": "entry_date",
            "values": [datetime.date(2020, 1, 1), datetime.date(2000, 1, 1)],
        },  # first date within study period, second date after
        {"name": "breast_cancer_code", "values": ["b1", "b4"]},
        {
            "name": "breast_cancer_date",
            "values": [datetime.date(2019, 5, 1), datetime.date(2021, 10, 1)],
        },
        {
            "name": "REGSTARTDATE",
            "values": [datetime.date(2018, 1, 1), datetime.date(2019, 10, 1)],
        },  # this is the start date of coverage. i will manually sett index date (date of entry) as 2020.01.01. cc callculated from there. end date similarly a date after index date
        {"name": "ACCEPTABLE", "values": [1, 0]},
        {"name": "YOB", "values": [1970, 2010]},
        {"name": "GENDER", "values": [2, 1]},
        # {"name":"prior_et_use", "values":['d7','d5']},
    ]

    # create the dataframe with two rows; first patient fulfills entry criteria, second does not
    item = inclusion[0]
    df = pd.DataFrame()
    df[item["name"]] = item["values"]

    # iterate over each following criteria, duplicating the previous values
    for item in inclusion[1:]:
        _dfs = []
        for value in item["values"]:
            _df = pd.DataFrame(df)
            _df[item["name"]] = value
            _dfs.append(_df)
        df = pd.concat(_dfs)
    # create appropriate patient ids. only patient 0 fulfills all criteria!
    df["PATID"] = [f"P{i}" for i in range(df.shape[0])]
    return df


def test_simple_cohort():
    cprd_study = SimpleCohortTestGenerator()
    cprd_study.run_tests()


if __name__ == "__main__":
    test_simple_cohort()
