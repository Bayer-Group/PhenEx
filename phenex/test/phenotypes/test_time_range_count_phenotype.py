import datetime, os
import pandas as pd

from phenex.phenotypes.time_range_count_phenotype import TimeRangeCountPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.filters import ValueFilter, RelativeTimeRangeFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class TimeRangeCountPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "trcpt"
    test_values = True

    def define_input_tables(self):
        oneday = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)

        # Create test data with multiple time ranges per person
        # Some people will have overlapping periods, some will have gaps
        df_visit_occurrence = pd.DataFrame()

        # Person P1: 3 visits, 1 before index, 2 after index
        p1_data = [
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date - 30 * oneday,
                "END_DATE": index_date - 25 * oneday,
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 10 * oneday,
                "END_DATE": index_date + 15 * oneday,
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 60 * oneday,
                "END_DATE": index_date + 65 * oneday,
            },
        ]

        # Person P2: 2 visits, both after index
        p2_data = [
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 5 * oneday,
                "END_DATE": index_date + 10 * oneday,
            },
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 50 * oneday,
                "END_DATE": index_date + 55 * oneday,
            },
        ]

        # Person P3: 4 visits, 2 before index, 2 after index
        p3_data = [
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date - 60 * oneday,
                "END_DATE": index_date - 55 * oneday,
            },
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date - 30 * oneday,
                "END_DATE": index_date - 25 * oneday,
            },
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date + 15 * oneday,
                "END_DATE": index_date + 20 * oneday,
            },
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date + 90 * oneday,
                "END_DATE": index_date + 95 * oneday,
            },
        ]

        # Person P4: 1 visit, overlapping index date (should be excluded from before/after counts)
        p4_data = [
            {
                "PERSON_ID": "P4",
                "START_DATE": index_date - 5 * oneday,
                "END_DATE": index_date + 5 * oneday,
            },
        ]

        # Person P5: No visits
        p5_data = []

        # Person P6: 5 visits, all after index within 100 days
        p6_data = [
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 10 * oneday,
                "END_DATE": index_date + 12 * oneday,
            },
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 20 * oneday,
                "END_DATE": index_date + 22 * oneday,
            },
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 30 * oneday,
                "END_DATE": index_date + 32 * oneday,
            },
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 40 * oneday,
                "END_DATE": index_date + 42 * oneday,
            },
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 50 * oneday,
                "END_DATE": index_date + 52 * oneday,
            },
        ]

        all_data = p1_data + p2_data + p3_data + p4_data + p5_data + p6_data
        df_visit_occurrence = pd.DataFrame(all_data)

        # Add INDEX_DATE column for all persons (needed for tests without anchor)
        all_persons = ["P1", "P2", "P3", "P4", "P5", "P6"]
        df_index = pd.DataFrame(
            {"PERSON_ID": all_persons, "INDEX_DATE": [index_date] * len(all_persons)}
        )

        # If we have visit data, merge with index dates, otherwise just use index data
        if not df_visit_occurrence.empty:
            df_visit_occurrence = df_visit_occurrence.merge(
                df_index, on="PERSON_ID", how="right"
            )
        else:
            df_visit_occurrence = df_index
            df_visit_occurrence["START_DATE"] = None
            df_visit_occurrence["END_DATE"] = None

        self.df_input = df_visit_occurrence
        input_info_visit_occurrence = {
            "name": "VISIT_OCCURRENCE",
            "df": df_visit_occurrence,
        }

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = df_visit_occurrence["PERSON_ID"].unique()

        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }

        return [input_info_visit_occurrence, input_info_person]

    def define_phenotype_tests(self):
        # Test 1: Count all visits (no time filtering)
        t1 = {
            "name": "count_all_visits",
            "persons": ["P1", "P2", "P3", "P4", "P6", "P5"],  # P5 has no visits
            "values": [3, 2, 4, 1, 5, 0],  # Expected visit counts
        }

        # Test 2: Count visits after index (should exclude overlapping periods)
        t2 = {
            "name": "count_visits_after_index",
            "persons": [
                "P1",
                "P2",
                "P3",
                "P6",
                "P4",
                "P5",
            ],  # P4's visit overlaps index, P5 has none
            "values": [2, 2, 2, 5, 0, 0],  # Expected after-index visit counts
        }

        # Test 3: Count visits before index (should exclude overlapping periods)
        t3 = {
            "name": "count_visits_before_index",
            "persons": [
                "P1",
                "P3",
                "P2",
                "P4",
                "P5",
                "P6",
            ],  # Only P1 and P3 have visits before index
            "values": [1, 2, 0, 0, 0, 0],  # Expected before-index visit counts
        }

        # Test 4: Count visits after index with max days set
        t4 = {
            "name": "max_days_set",
            "persons": ["P1", "P2", "P3", "P6", "P4", "P5"],
            "values": [1, 1, 1, 5, 0, 0],
        }

        # Test 5: Count visits after index with min value filter (at least 2 visits)
        t5 = {
            "name": "min_days_set",
            "persons": [
                "P1",
                "P2",
                "P3",
                "P6",
                "P4",
                "P5",
            ],  # All have at least 2 visits after index
            "values": [2, 1, 2, 5, 0, 0],  # Expected after-index visit counts
        }

        # Test 6: min days with value filter
        t6 = {
            "name": "min_days_set_with_value_filter",
            "persons": [
                "P1",
                "P3",
                "P2",
                "P4",
                "P5",
                "P6",
            ],  # All have at least 2 visits after index
            "values": [2, 2, 0, 0, 0, 0],
        }

        # Test 7: Count all visits (no time filtering)
        t7 = {
            "name": "value_filter",
            "persons": ["P1", "P3", "P6", "P2", "P4", "P5"],  # P5 has no visits
            "values": [3, 4, 5, 0, 0, 0],  # Expected visit counts
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7]

        # Create phenotypes for each test
        t1["phenotype"] = TimeRangeCountPhenotype(
            name=t1["name"], domain="VISIT_OCCURRENCE"
        )

        t2["phenotype"] = TimeRangeCountPhenotype(
            name=t2["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(when="after"),
        )

        t3["phenotype"] = TimeRangeCountPhenotype(
            name=t3["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(when="before"),
        )

        t4["phenotype"] = TimeRangeCountPhenotype(
            name=t4["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                max_days=LessThanOrEqualTo(
                    52
                ),  # lies directly after P6 end date and in the middle of P2 end date i.e. check that P6 remains while P2 events removed. additionally fully excludes P3 start date.
            ),
        )

        t5["phenotype"] = TimeRangeCountPhenotype(
            name=t5["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(
                    9
                ),  # lies directly before P1 start. excludes P2  start date,
            ),
        )

        t6["phenotype"] = TimeRangeCountPhenotype(
            name=t6["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(
                    9
                ),  # lies directly before P1 start. excludes P2  start date,
            ),
            value_filter=ValueFilter(
                min_value=GreaterThan(1), max_value=LessThanOrEqualTo(2)
            ),
        )

        t7["phenotype"] = TimeRangeCountPhenotype(
            name=t7["name"],
            domain="VISIT_OCCURRENCE",
            value_filter=ValueFilter(
                min_value=GreaterThan(2),
            ),
        )

        return test_infos


class TimeRangeCountWithAnchorPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "trcpt_anchor"
    test_values = True

    def define_input_tables(self):
        index_date = datetime.date(2022, 1, 1)
        oneday = datetime.timedelta(days=1)

        # Create condition occurrence data (for anchor phenotype)
        df_condition = pd.DataFrame(
            {
                "PERSON_ID": ["P1", "P2", "P3"],
                "CODE": ["AF", "AF", "AF"],
                "CODE_TYPE": "ICD10",
                "EVENT_DATE": [index_date, index_date, index_date],
            }
        )

        # Create visit occurrence data (for counting)
        visit_data = [
            # P1: 1 visit before, 2 visits after anchor
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date - 30 * oneday,
                "END_DATE": index_date - 25 * oneday,
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 10 * oneday,
                "END_DATE": index_date + 15 * oneday,
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 60 * oneday,
                "END_DATE": index_date + 65 * oneday,
            },
            # P2: 2 visits after anchor
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 20 * oneday,
                "END_DATE": index_date + 25 * oneday,
            },
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 80 * oneday,
                "END_DATE": index_date + 85 * oneday,
            },
            # P3: 1 visit before anchor
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date - 45 * oneday,
                "END_DATE": index_date - 40 * oneday,
            },
        ]

        df_visit = pd.DataFrame(visit_data)

        input_info_condition = {"name": "CONDITION_OCCURRENCE", "df": df_condition}
        input_info_visit = {"name": "VISIT_OCCURRENCE", "df": df_visit}

        return [input_info_condition, input_info_visit]

    def define_phenotype_tests(self):
        # Create entry phenotype (anchor)
        entry = CodelistPhenotype(
            name="entry",
            codelist=Codelist(name="AF", codelist={"ICD10": ["AF"]}),
            domain="CONDITION_OCCURRENCE",
        )

        # Test counting visits after entry phenotype
        t1 = {
            "name": "count_visits_after_entry",
            "persons": ["P1", "P2"],  # P3 has no visits after entry
            "values": [2, 2],
            "phenotype": TimeRangeCountPhenotype(
                name="count_visits_after_entry",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="after", anchor_phenotype=entry
                ),
            ),
        }

        # Test counting visits before entry phenotype
        t2 = {
            "name": "count_visits_before_entry",
            "persons": ["P1", "P3"],  # P2 has no visits before entry
            "values": [1, 1],
            "phenotype": TimeRangeCountPhenotype(
                name="count_visits_before_entry",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="before", anchor_phenotype=entry
                ),
            ),
        }

        return [t1, t2]


class TimeRangeCountWithDaysFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "trcpt_days_filter"
    test_values = True

    def define_input_tables(self):
        index_date = datetime.date(2022, 1, 1)
        oneday = datetime.timedelta(days=1)

        # Create visit data with specific day offsets for testing day filters
        visit_data = [
            # P1: visits at various day offsets after index
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 5 * oneday,
                "END_DATE": index_date + 7 * oneday,
            },  # 5 days after
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 15 * oneday,
                "END_DATE": index_date + 17 * oneday,
            },  # 15 days after
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 45 * oneday,
                "END_DATE": index_date + 47 * oneday,
            },  # 45 days after
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 120 * oneday,
                "END_DATE": index_date + 122 * oneday,
            },  # 120 days after
            # P2: visits within 30 days after index
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 10 * oneday,
                "END_DATE": index_date + 12 * oneday,
            },  # 10 days after
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 25 * oneday,
                "END_DATE": index_date + 27 * oneday,
            },  # 25 days after
        ]

        df_visit = pd.DataFrame(visit_data)

        # Add INDEX_DATE
        all_persons = ["P1", "P2"]
        df_index = pd.DataFrame(
            {"PERSON_ID": all_persons, "INDEX_DATE": [index_date] * len(all_persons)}
        )

        df_visit = df_visit.merge(df_index, on="PERSON_ID", how="right")

        input_info_visit = {"name": "VISIT_OCCURRENCE", "df": df_visit}
        return [input_info_visit]

    def define_phenotype_tests(self):
        # Test: Count visits 30-90 days after index
        t1 = {
            "name": "count_visits_30_to_90_days_after",
            "persons": ["P1"],  # Only P1 has a visit in this range (45 days)
            "values": [1],
            "phenotype": TimeRangeCountPhenotype(
                name="count_visits_30_to_90_days_after",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="after",
                    min_days=GreaterThanOrEqualTo(30),
                    max_days=LessThanOrEqualTo(90),
                ),
            ),
        }

        # Test: Count visits within 30 days after index
        t2 = {
            "name": "count_visits_within_30_days_after",
            "persons": ["P1", "P2"],  # P1 has 2 visits, P2 has 2 visits within 30 days
            "values": [2, 2],
            "phenotype": TimeRangeCountPhenotype(
                name="count_visits_within_30_days_after",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="after", max_days=LessThanOrEqualTo(30)
                ),
            ),
        }

        return [t1, t2]


def test_time_range_count_phenotypes():
    """Test basic time range counting functionality."""
    spg = TimeRangeCountPhenotypeTestGenerator()
    spg.run_tests()


def test_time_range_count_with_anchor_phenotype():
    """Test time range counting with anchor phenotype."""
    spg = TimeRangeCountWithAnchorPhenotypeTestGenerator()
    spg.run_tests()


def test_time_range_count_with_days_filter():
    """Test time range counting with day-based filtering."""
    spg = TimeRangeCountWithDaysFilterTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_time_range_count_phenotypes()
    test_time_range_count_with_anchor_phenotype()
    test_time_range_count_with_days_filter()
