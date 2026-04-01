import datetime, os
import pandas as pd

from phenex.phenotypes.death_phenotype import DeathPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_filter import DateFilter, AfterOrOn, BeforeOrOn
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class DeathPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "dtpt"
    test_date = True

    def define_input_tables(self):
        index_date = datetime.datetime.strptime("01-01-2022", "%m-%d-%Y")

        self.n_persons = 9

        death_dates = (
            [None]
            + [index_date - datetime.timedelta(days=20 * i) for i in range(4)]
            + [index_date + datetime.timedelta(days=20 * i) for i in range(4)]
        )

        N = len(death_dates)

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = [f"P{x}" for x in list(range(N))]
        df_person["DATE_OF_DEATH"] = death_dates
        df_person["INDEX_DATE"] = index_date

        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }

        self.input_table = df_person
        return [input_info_person]

    def define_phenotype_tests(self):
        idx_persons = [1, 2, 3, 4, 5]
        t1 = {
            "name": "death_prior_including_index",
            "time_range_filter": RelativeTimeRangeFilter(when="before"),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }

        idx_persons = [2, 3, 4]
        t2 = {
            "name": "death_prior_index",
            "time_range_filter": RelativeTimeRangeFilter(
                when="before", min_days=GreaterThan(0)
            ),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }

        idx_persons = [1, 2, 5]
        t3 = {
            "name": "death_prior_including_index_max20",
            "time_range_filter": RelativeTimeRangeFilter(
                when="before", max_days=Value("<=", 30)
            ),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }

        idx_persons = [2]
        t4 = {
            "name": "death_prior_index_max_20",
            "time_range_filter": RelativeTimeRangeFilter(
                when="before", min_days=GreaterThan(0), max_days=Value("<=", 30)
            ),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }

        idx_persons = [1, 5, 6, 7, 8]
        t5 = {
            "name": "death_post_including_index",
            "time_range_filter": RelativeTimeRangeFilter(when="after"),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }

        idx_persons = [6, 7, 8]
        t6 = {
            "name": "death_post_index",
            "time_range_filter": RelativeTimeRangeFilter(
                when="after", min_days=GreaterThan(0)
            ),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }

        idx_persons = [1, 5, 6]
        t7 = {
            "name": "death_post_including_index_max20",
            "time_range_filter": RelativeTimeRangeFilter(
                when="after", max_days=Value("<=", 30)
            ),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }
        idx_persons = [6]
        t8 = {
            "name": "death_post_index_max_20",
            "time_range_filter": RelativeTimeRangeFilter(
                when="after", min_days=GreaterThan(0), max_days=Value("<=", 30)
            ),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }
        idx_persons = [7]
        t9 = {
            "name": "death_post_min_30_max_50",
            "time_range_filter": RelativeTimeRangeFilter(
                when="after", min_days=Value(">", 30), max_days=Value("<=", 50)
            ),
            "persons": [f"P{x}" for x in idx_persons],
            "dates": [
                x
                for i, x in enumerate(self.input_table["DATE_OF_DEATH"].values)
                if i in idx_persons
            ],
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7, t8, t9]

        for test_info in test_infos:
            test_info["phenotype"] = DeathPhenotype(
                name=test_info["name"],
                relative_time_range=test_info.get("time_range_filter"),
            )

        return test_infos


def test_death_phenotype():
    spg = DeathPhenotypeTestGenerator()
    spg.run_tests()


class DeathPhenotypeDateRangeTestGenerator(PhenotypeTestGenerator):
    name_space = "dtpt_dr_val"
    test_date = True
    test_values = True

    def define_input_tables(self):
        index_date = datetime.datetime.strptime("01-01-2022", "%m-%d-%Y")

        death_dates = [
            None,
            index_date - datetime.timedelta(days=10),  # P1: 2021-12-22
            index_date,  # P2: 2022-01-01
            index_date + datetime.timedelta(days=15),  # P3: 2022-01-16
            index_date + datetime.timedelta(days=40),  # P4: 2022-02-10
        ]

        self.input_table = pd.DataFrame()
        self.input_table["PERSON_ID"] = [f"P{x}" for x in range(len(death_dates))]
        self.input_table["DATE_OF_DEATH"] = death_dates
        self.input_table["INDEX_DATE"] = index_date

        return [{"name": "PERSON", "df": self.input_table}]

    def define_phenotype_tests(self):
        dt_start = "2021-12-01"
        dt_end = "2022-01-31"

        t1 = {
            "name": "death_daterange_and_after",
            "phenotype": DeathPhenotype(
                name="test_death1",
                date_range=DateFilter(min_date=AfterOrOn(dt_start), max_date=BeforeOrOn(dt_end)),
                relative_time_range=RelativeTimeRangeFilter(when="after")
            ),
            "persons": ["P2", "P3"],
            "dates": [
                self.input_table["DATE_OF_DEATH"][2],
                self.input_table["DATE_OF_DEATH"][3]
            ],
            "values": [0, 15]
        }

        t2 = {
            "name": "death_daterange_and_before",
            "phenotype": DeathPhenotype(
                name="test_death2",
                date_range=DateFilter(min_date=AfterOrOn(dt_start), max_date=BeforeOrOn(dt_end)),
                relative_time_range=RelativeTimeRangeFilter(when="before")
            ),
            "persons": ["P1", "P2"],
            "dates": [
                self.input_table["DATE_OF_DEATH"][1],
                self.input_table["DATE_OF_DEATH"][2]
            ],
            "values": [-10, 0]
        }

        return [t1, t2]


def test_death_phenotype_date_range_and_value():
    spg = DeathPhenotypeDateRangeTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_death_phenotype()
    test_death_phenotype_date_range_and_value()
