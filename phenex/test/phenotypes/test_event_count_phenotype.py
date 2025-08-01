import datetime, os
import pandas as pd

from phenex.phenotypes import CodelistPhenotype, EventCountPhenotype
from phenex.codelists import Codelist
from phenex.filters import (
    CategoricalFilter,
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    LessThanOrEqualTo,
    LessThan,
    GreaterThan,
    ValueFilter,
)

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class EventCountTestGenerator(PhenotypeTestGenerator):
    name_space = "ecpt"
    test_date = True

    def define_input_tables(self):

        df = pd.DataFrame()
        df["PERSON_ID"] = ["P1", "P1", "P1", "P1", "P2", "P2"]
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        self.one_day = datetime.timedelta(days=1)
        self.index_date = datetime.date(2022, 1, 1)

        df["EVENT_DATE"] = [
            self.index_date - 10 * self.one_day,
            self.index_date - 9 * self.one_day,
            self.index_date - self.one_day,
            self.index_date,
        ] + [
            self.index_date - 10 * self.one_day,
            self.index_date - self.one_day,
        ]
        df["INDEX_DATE"] = self.index_date

        print(df)
        return [
            {"name": "condition_occurrence", "df": df},
        ]

    def define_phenotype_tests(self):

        pt1_prior = CodelistPhenotype(
            codelist=Codelist("c1"),
            domain="condition_occurrence",
            return_date="all",
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(0),
                when="before",
            ),
        )

        t1 = {
            "name": "two_events_return_all",
            "persons": ["P1", "P1"],
            "dates": [self.index_date - self.one_day, self.index_date],
            "phenotype": EventCountPhenotype(
                phenotype=pt1_prior,
                value_filter=ValueFilter(min_value=GreaterThan(2)),
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(5),
                ),
                return_date="all",
            ),
        }

        t2 = {
            "name": "two_events_return_first",
            "persons": ["P1"],
            "dates": [
                self.index_date - self.one_day,
            ],
            "phenotype": EventCountPhenotype(
                phenotype=pt1_prior,
                value_filter=ValueFilter(min_value=GreaterThan(2)),
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(5),
                ),
                return_date="first",
            ),
        }

        t3 = {
            "name": "two_events_return_last",
            "persons": ["P1"],
            "dates": [
                self.index_date,
            ],
            "phenotype": EventCountPhenotype(
                phenotype=pt1_prior,
                value_filter=ValueFilter(min_value=GreaterThan(2)),
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(5),
                ),
                return_date="last",
            ),
        }

        t4 = {
            "name": "two_events_return_all_first_event",
            "persons": ["P1", "P1"],
            "dates": [
                self.index_date - 10 * self.one_day,
                self.index_date - 9 * self.one_day,
            ],
            "phenotype": EventCountPhenotype(
                phenotype=pt1_prior,
                value_filter=ValueFilter(min_value=GreaterThan(2)),
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(5),
                ),
                return_date="all",
                component_date_select="first",
            ),
        }

        t5 = {
            "name": "two_events_return_last_first_event",
            "persons": ["P1"],
            "dates": [
                self.index_date - 9 * self.one_day,
            ],
            "phenotype": EventCountPhenotype(
                phenotype=pt1_prior,
                value_filter=ValueFilter(min_value=GreaterThan(2)),
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(5),
                ),
                return_date="last",
                component_date_select="first",
            ),
        }

        t6 = {
            "name": "two_events_return_first_first_event",
            "persons": ["P1"],
            "dates": [
                self.index_date - 10 * self.one_day,
            ],
            "phenotype": EventCountPhenotype(
                phenotype=pt1_prior,
                value_filter=ValueFilter(min_value=GreaterThan(2)),
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(5),
                ),
                return_date="first",
                component_date_select="first",
            ),
        }

        t7 = {
            "name": "filter_counts",
            "persons": ["P1", "P2"],
            "dates": [
                self.index_date - 10 * self.one_day,
                self.index_date - 10 * self.one_day,
            ],
            "phenotype": EventCountPhenotype(
                phenotype=pt1_prior,
                value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(2)),
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(5),
                ),
                return_date="first",
                component_date_select="first",
            ),
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


def test_event_count_phenotype_with_time():
    spg = EventCountTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_event_count_phenotype_with_time()
