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
        """
        Create test data using the same time ranges as TimeRangeFilter tests.
        Each period is 30 days long.
        
        Time ranges relative to INDEX (2020-05-15):
        p1: 2020-01-01 to 2020-01-30 (30 days) - 104 to 135 days BEFORE index
        p2: 2020-03-01 to 2020-03-30 (30 days) - 45 to 76 days BEFORE index  
        p3: 2020-05-01 to 2020-05-30 (30 days) - 14 days BEFORE to 15 days AFTER index (overlaps)
        p4: 2020-07-01 to 2020-07-30 (30 days) - 47 to 76 days AFTER index
        p5: 2020-09-01 to 2020-09-30 (30 days) - 109 to 138 days AFTER index
        """
        # Use the same time constants as day count test
        INDEX = datetime.date(2020, 5, 15)
        p1_START = datetime.date(2020, 1, 1)
        p2_START = datetime.date(2020, 3, 1) 
        p3_START = datetime.date(2020, 5, 1)
        p4_START = datetime.date(2020, 7, 1)
        p5_START = datetime.date(2020, 9, 1)
        
        p1_END = datetime.date(2020, 1, 30)
        p2_END = datetime.date(2020, 3, 30)
        p3_END = datetime.date(2020, 5, 30)
        p4_END = datetime.date(2020, 7, 30)
        p5_END = datetime.date(2020, 9, 30)
        
        # Create visit occurrence data - P1 with 5 time ranges, P2 with 1 time range before index
        visit_data = [
            {
                "PERSON_ID": "P1",
                "START_DATE": p1_START,
                "END_DATE": p1_END,
            },
            {
                "PERSON_ID": "P1", 
                "START_DATE": p2_START,
                "END_DATE": p2_END,
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": p3_START,
                "END_DATE": p3_END,
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": p4_START,
                "END_DATE": p4_END,
            },
            {
                "PERSON_ID": "P1",
                "START_DATE": p5_START,
                "END_DATE": p5_END,
            },
            {
                "PERSON_ID": "P2",
                "START_DATE": p1_START,
                "END_DATE": p1_END,
            },
        ]
        
        df_visit_occurrence = pd.DataFrame(visit_data)

        # Add INDEX_DATE column for all persons
        all_persons = ["P1", "P2"]
        df_index = pd.DataFrame(
            {"PERSON_ID": all_persons, "INDEX_DATE": [INDEX] * len(all_persons)}
        )

        df_visit_occurrence = df_visit_occurrence.merge(df_index, on="PERSON_ID", how="right")
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
        # Test 1: Count all time ranges (no time filtering) 
        # P1 has 5 ranges, P2 has 1 range
        t1 = {
            "name": "count_all_visits",
            "persons": ["P1", "P2"],
            "values": [5, 1],  # Expected time range counts
        }

        # Test 2: Count time ranges after index (should exclude overlapping periods)
        # P1: p4 and p5 are entirely after index = 2 ranges
        # P2: no ranges after index = 0 ranges
        t2 = {
            "name": "count_visits_after_index",
            "persons": ["P1", "P2"],
            "values": [2, 0],  # Expected after-index time range counts
        }

        # Test 3: Count time ranges before index (should exclude overlapping periods)  
        # P1: p1 and p2 are entirely before index = 2 ranges
        # P2: p1 is entirely before index = 1 range
        t3 = {
            "name": "count_visits_before_index",
            "persons": ["P1", "P2"],
            "values": [2, 1],  # Expected before-index time range counts
        }

        # Test 4: Count time ranges after index with max 90 days constraint
        # P1: p4 (starts day 47) is within 90 days, p5 (starts day 109) is beyond = 1 range
        # P2: no ranges after index = 0 ranges
        t4 = {
            "name": "max_days_set",
            "persons": ["P1", "P2"],
            "values": [1, 0],
        }

        # Test 5: Count time ranges after index with min 30 days constraint
        # P1: p4 (starts day 47) and p5 (starts day 109) both >= 30 days after = 2 ranges
        # P2: no ranges after index = 0 ranges
        t5 = {
            "name": "min_days_set",
            "persons": ["P1", "P2"],
            "values": [2, 0],  # Expected after-index time range counts with min constraint
        }

        # Test 6: min days with value filter (exactly 2 ranges)
        # P1: has 2 ranges after min constraint, fits filter = 2 ranges
        # P2: has 0 ranges, doesn't meet min filter = 0 ranges
        t6 = {
            "name": "min_days_set_with_value_filter",
            "persons": ["P1"],
            "values": [2],
        }

        # Test 7: Value filter (more than 2 total ranges)
        # P1: has 5 ranges total, meets filter = 5 ranges  
        # P2: has 1 range total, doesn't meet filter = 0 ranges
        t7 = {
            "name": "value_filter",
            "persons": ["P1"],
            "values": [5],  # Expected visit counts
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
                max_days=LessThanOrEqualTo(90)  # Up to 90 days after index (excludes p5)
            ),
        )

        t5["phenotype"] = TimeRangeCountPhenotype(
            name=t5["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(30)  # At least 30 days after index (includes p4, p5)
            ),
        )

        t6["phenotype"] = TimeRangeCountPhenotype(
            name=t6["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(30)  # At least 30 days after index
            ),
            value_filter=ValueFilter(
                min_value=GreaterThanOrEqualTo(2), max_value=LessThanOrEqualTo(4)  # Exactly 2 ranges
            ),
        )

        t7["phenotype"] = TimeRangeCountPhenotype(
            name=t7["name"],
            domain="VISIT_OCCURRENCE",
            value_filter=ValueFilter(
                min_value=GreaterThan(2),  # More than 2 total ranges
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
