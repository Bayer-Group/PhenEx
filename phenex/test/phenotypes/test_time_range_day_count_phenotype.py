import datetime, os
import pandas as pd

from phenex.phenotypes.time_range_day_count_phenotype import TimeRangeDayCountPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.filters import ValueFilter, RelativeTimeRangeFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *

# Use the same time ranges as TimeRangeFilter tests for consistency
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


class TimeRangeDayCountPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "trdcpt"
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
        
        # Create visit occurrence data - single person with 5 time ranges
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
        
        # Add INDEX_DATE column
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
        # Test 1: Count all days (no time filtering)
        # Should count all 5 periods: 30 + 30 + 30 + 30 + 30 = 150 days
        t1 = {
            "name": "count_all_days",
            "persons": ["P1", "P2"],
            "values": [150, 30],
        }

        # Test 2: Count days before index 
        # Should count p1 (30 days) + p2 (30 days) + part of p3 (14 days before index) = 74 days
        t2 = {
            "name": "count_days_before_index",
            "persons": ["P1", "P2"],
            "values": [75, 30],
        }

        # Test 3: Count days after index
        # Should count part of p3 (15 days after index) + p4 (30 days) + p5 (30 days) = 75 days
        t3 = {
            "name": "count_days_after_index",
            "persons": ["P1", "P2"],
            "values": [76, 0],
        }

        # Test 4: Count days after index with min constraint (at least 30 days after)
        # Should only count p4 (30 days) + p5 (30 days) = 60 days
        t4 = {
            "name": "count_days_after_min30",
            "persons": ["P1", "P2"],
            "values": [60, 0],
        }

        # Test 5: Count days after index with max constraint (up to 90 days after)
        # Should count part of p3 (15 days) + p4 (30 days) = 45 days
        t5 = {
            "name": "count_days_after_max90",
            "persons": ["P1", "P2"],
            "values": [46, 0],
        }

        # Test 6: Count days after index with min and max constraints (30-90 days after)
        # Should only count p4: starts at day 47, ends at day 76, so 30 days
        t6 = {
            "name": "count_days_after_30to90",
            "persons": ["P1", "P2"],
            "values": [30, 0],
        }

        # Test 7: Count days with value filter (minimum 100 total days)
        # Total is 150 days, which is >= 100, so should return the result
        t7 = {
            "name": "count_days_min100",
            "persons": ["P1", "P2"],
            "values": [150, 0],
        }

        # Test 8: Count days before index with min constraint (at least 30 days before)
        # Should count p1 (30 days) + p2 (30 days) = 60 days
        t8 = {
            "name": "count_days_before_min30",
            "persons": ["P1", "P2"],
            "values": [60, 30],
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7, t8]

        # Create phenotypes for each test
        t1["phenotype"] = TimeRangeDayCountPhenotype(
            name=t1["name"], domain="VISIT_OCCURRENCE"
        )

        t2["phenotype"] = TimeRangeDayCountPhenotype(
            name=t2["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(when="before"),
        )

        t3["phenotype"] = TimeRangeDayCountPhenotype(
            name=t3["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(when="after"),
        )

        t4["phenotype"] = TimeRangeDayCountPhenotype(
            name=t4["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(30)  # At least 30 days after index
            ),
        )

        t5["phenotype"] = TimeRangeDayCountPhenotype(
            name=t5["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", 
                max_days=LessThanOrEqualTo(90)  # Up to 90 days after index
            ),
        )

        t6["phenotype"] = TimeRangeDayCountPhenotype(
            name=t6["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(30),  # At least 30 days after
                max_days=LessThanOrEqualTo(90)      # Up to 90 days after
            ),
        )

        t7["phenotype"] = TimeRangeDayCountPhenotype(
            name=t7["name"],
            domain="VISIT_OCCURRENCE",
            value_filter=ValueFilter(
                min_value=GreaterThanOrEqualTo(100)  # At least 100 total days
            ),
        )

        t8["phenotype"] = TimeRangeDayCountPhenotype(
            name=t8["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before",
                min_days=GreaterThanOrEqualTo(30)  # At least 30 days before index
            ),
        )

        return test_infos


def test_time_range_day_count_phenotypes():
    """Test basic time range day counting functionality."""
    spg = TimeRangeDayCountPhenotypeTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_time_range_day_count_phenotypes()
    name_space = "trdcpt"
    test_values = True


