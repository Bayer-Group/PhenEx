import datetime, os
import pandas as pd

from phenex.phenotypes.time_range_day_count_phenotype import TimeRangeDayCountPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.filters import ValueFilter, RelativeTimeRangeFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class TimeRangeDayCountPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "trdcpt"
    test_values = True

    def define_input_tables(self):
        oneday = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)

        # Create test data with multiple time ranges per person
        # Each range has different durations to test day counting
        df_visit_occurrence = pd.DataFrame()

        # Person P1: 3 visits - total 16 days (6 + 6 + 6 days)
        # 1 before index (6 days), 2 after index (6 + 6 = 12 days)
        p1_data = [
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date - 30 * oneday,
                "END_DATE": index_date - 25 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 10 * oneday,
                "END_DATE": index_date + 15 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 60 * oneday,
                "END_DATE": index_date + 65 * oneday,  # 6 days
            },
        ]

        # Person P2: 2 visits, both after index - total 12 days (6 + 6)
        p2_data = [
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 5 * oneday,
                "END_DATE": index_date + 10 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 50 * oneday,
                "END_DATE": index_date + 55 * oneday,  # 6 days
            },
        ]

        # Person P3: 4 visits - total 24 days (6 + 6 + 6 + 6)
        # 2 before index (12 days), 2 after index (12 days)
        p3_data = [
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date - 60 * oneday,
                "END_DATE": index_date - 55 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date - 30 * oneday,
                "END_DATE": index_date - 25 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date + 15 * oneday,
                "END_DATE": index_date + 20 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date + 90 * oneday,
                "END_DATE": index_date + 95 * oneday,  # 6 days
            },
        ]

        # Person P4: 1 visit, overlapping index date - 11 days total
        # Should be INCLUDED in day count (unlike TimeRangeCountPhenotype)
        p4_data = [
            {
                "PERSON_ID": "P4",
                "START_DATE": index_date - 5 * oneday,
                "END_DATE": index_date + 5 * oneday,  # 11 days
            },
        ]

        # Person P5: No visits
        p5_data = []

        # Person P6: 5 visits, all after index - total 15 days (3 + 3 + 3 + 3 + 3)
        p6_data = [
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 10 * oneday,
                "END_DATE": index_date + 12 * oneday,  # 3 days
            },
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 20 * oneday,
                "END_DATE": index_date + 22 * oneday,  # 3 days
            },
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 30 * oneday,
                "END_DATE": index_date + 32 * oneday,  # 3 days
            },
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 40 * oneday,
                "END_DATE": index_date + 42 * oneday,  # 3 days
            },
            {
                "PERSON_ID": "P6",
                "START_DATE": index_date + 50 * oneday,
                "END_DATE": index_date + 52 * oneday,  # 3 days
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
        # Test 1: Count all visit days (no time filtering)
        t1 = {
            "name": "count_all_visit_days",
            "persons": ["P1", "P2", "P3", "P4", "P6", "P5"],  # P5 has no visits
            "values": [18, 12, 24, 11, 15, 0],  # Expected total day counts
        }

        # Test 2: Count visit days after index (should include overlapping periods)
        t2 = {
            "name": "count_visit_days_after_index",
            "persons": [
                "P1",
                "P2", 
                "P3",
                "P4",  # P4's visit overlaps index - should be included
                "P6",
                "P5",
            ],
            "values": [12, 12, 12, 6, 15, 0],  # Expected after-index day counts
        }

        # Test 3: Count visit days before index (should include overlapping periods)
        t3 = {
            "name": "count_visit_days_before_index",
            "persons": [
                "P1",
                "P3",
                "P4",  # P4's visit overlaps index - should be included
                "P2",
                "P5",
                "P6",
            ],
            "values": [6, 12, 6, 0, 0, 0],  # Expected before-index day counts
        }

        # Test 4: Count visit days after index with max days constraint
        t4 = {
            "name": "max_days_set",
            "persons": ["P1", "P2", "P3", "P4", "P6", "P5"],
            "values": [6, 6, 6, 6, 15, 0],  # Only visits within 52 days after index
        }

        # Test 5: Count visit days after index with min days constraint
        t5 = {
            "name": "min_days_set",
            "persons": [
                "P1",
                "P2", 
                "P3",
                "P4",
                "P6",
                "P5",
            ],
            "values": [6, 6, 6, 0, 15, 0],  # Only visits starting 9+ days after index
        }

        # Test 6: Min days with value filter (at least 6 days)
        t6 = {
            "name": "min_days_set_with_value_filter",
            "persons": [
                "P1",
                "P2",
                "P3", 
                "P6",
                "P4",
                "P5",
            ],
            "values": [6, 6, 6, 15, 0, 0],  # Only those with 6+ days after min constraint
        }

        # Test 7: Value filter (at least 12 days total)
        t7 = {
            "name": "value_filter",
            "persons": ["P1", "P2", "P3", "P6", "P4", "P5"],
            "values": [18, 12, 24, 15, 0, 0],  # Only those with 12+ total days
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7]

        # Create phenotypes for each test
        t1["phenotype"] = TimeRangeDayCountPhenotype(
            name=t1["name"], domain="VISIT_OCCURRENCE"
        )

        t2["phenotype"] = TimeRangeDayCountPhenotype(
            name=t2["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(when="after"),
        )

        t3["phenotype"] = TimeRangeDayCountPhenotype(
            name=t3["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(when="before"),
        )

        t4["phenotype"] = TimeRangeDayCountPhenotype(
            name=t4["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                max_days=LessThanOrEqualTo(52),  # Excludes P1's 60-day visit, P2's 50-day visit, P3's 90-day visit
            ),
        )

        t5["phenotype"] = TimeRangeDayCountPhenotype(
            name=t5["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(9),  # Excludes visits starting before 9 days after index
            ),
        )

        t6["phenotype"] = TimeRangeDayCountPhenotype(
            name=t6["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(9),
            ),
            value_filter=ValueFilter(
                min_value=GreaterThanOrEqualTo(6),  # At least 6 days
            ),
        )

        t7["phenotype"] = TimeRangeDayCountPhenotype(
            name=t7["name"],
            domain="VISIT_OCCURRENCE",
            value_filter=ValueFilter(
                min_value=GreaterThanOrEqualTo(12),  # At least 12 days total
            ),
        )

        return test_infos


class TimeRangeDayCountWithAnchorPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "trdcpt_anchor"
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

        # Create visit occurrence data (for counting days)
        visit_data = [
            # P1: 1 visit before (6 days), 2 visits after anchor (6 + 6 = 12 days)
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date - 30 * oneday,
                "END_DATE": index_date - 25 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 10 * oneday,
                "END_DATE": index_date + 15 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 60 * oneday,
                "END_DATE": index_date + 65 * oneday,  # 6 days
            },
            # P2: 2 visits after anchor (6 + 6 = 12 days)
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 20 * oneday,
                "END_DATE": index_date + 25 * oneday,  # 6 days
            },
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 80 * oneday,
                "END_DATE": index_date + 85 * oneday,  # 6 days
            },
            # P3: 1 visit before anchor (6 days)
            {
                "PERSON_ID": "P3",
                "START_DATE": index_date - 45 * oneday,
                "END_DATE": index_date - 40 * oneday,  # 6 days
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

        # Test counting visit days after entry phenotype
        t1 = {
            "name": "count_visit_days_after_entry",
            "persons": ["P1", "P2"],  # P3 has no visits after entry
            "values": [12, 12],  # Expected day counts after entry
            "phenotype": TimeRangeDayCountPhenotype(
                name="count_visit_days_after_entry",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="after", anchor_phenotype=entry
                ),
            ),
        }

        # Test counting visit days before entry phenotype
        t2 = {
            "name": "count_visit_days_before_entry",
            "persons": ["P1", "P3"],  # P2 has no visits before entry
            "values": [6, 6],  # Expected day counts before entry
            "phenotype": TimeRangeDayCountPhenotype(
                name="count_visit_days_before_entry",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="before", anchor_phenotype=entry
                ),
            ),
        }

        return [t1, t2]


class TimeRangeDayCountWithDaysFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "trdcpt_days_filter"
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
                "END_DATE": index_date + 7 * oneday,  # 3 days, starts 5 days after
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 15 * oneday,
                "END_DATE": index_date + 19 * oneday,  # 5 days, starts 15 days after
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 45 * oneday,
                "END_DATE": index_date + 49 * oneday,  # 5 days, starts 45 days after
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": index_date + 120 * oneday,
                "END_DATE": index_date + 124 * oneday,  # 5 days, starts 120 days after
            },
            # P2: visits within 30 days after index
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 10 * oneday,
                "END_DATE": index_date + 14 * oneday,  # 5 days, starts 10 days after
            },
            {
                "PERSON_ID": "P2",
                "START_DATE": index_date + 25 * oneday,
                "END_DATE": index_date + 29 * oneday,  # 5 days, starts 25 days after
            },
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
        # Test: Count visit days 30-90 days after index
        t1 = {
            "name": "count_visit_days_30_to_90_days_after",
            "persons": ["P1"],  # Only P1 has a visit in this range (45-day visit = 5 days)
            "values": [5],
            "phenotype": TimeRangeDayCountPhenotype(
                name="count_visit_days_30_to_90_days_after",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="after",
                    min_days=GreaterThanOrEqualTo(30),
                    max_days=LessThanOrEqualTo(90),
                ),
            ),
        }

        # Test: Count visit days within 30 days after index
        t2 = {
            "name": "count_visit_days_within_30_days_after",
            "persons": ["P1", "P2"],  # P1 has 8 days (3+5), P2 has 10 days (5+5)
            "values": [8, 10],
            "phenotype": TimeRangeDayCountPhenotype(
                name="count_visit_days_within_30_days_after",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="after", max_days=LessThanOrEqualTo(30)
                ),
            ),
        }

        return [t1, t2]


def test_time_range_day_count_phenotypes():
    """Test basic time range day counting functionality."""
    spg = TimeRangeDayCountPhenotypeTestGenerator()
    spg.run_tests()


def test_time_range_day_count_with_anchor_phenotype():
    """Test time range day counting with anchor phenotype."""
    spg = TimeRangeDayCountWithAnchorPhenotypeTestGenerator()
    spg.run_tests()


def test_time_range_day_count_with_days_filter():
    """Test time range day counting with day-based filtering."""
    spg = TimeRangeDayCountWithDaysFilterTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_time_range_day_count_phenotypes()
    test_time_range_day_count_with_anchor_phenotype()
    test_time_range_day_count_with_days_filter()