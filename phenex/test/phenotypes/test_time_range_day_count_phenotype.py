import datetime, os
import pandas as pd

from phenex.phenotypes.time_range_day_count_phenotype import TimeRangeDayCountPhenotype
from phenex.phenotypes.death_phenotype import DeathPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.filters import ValueFilter, RelativeTimeRangeFilter

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters import DateFilter, AfterOrOn, BeforeOrOn
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

        df_visit_occurrence = df_visit_occurrence.merge(
            df_index, on="PERSON_ID", how="right"
        )

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
            "persons": ["P1"],
            "values": [150],
        }

        # Test 8: Count days before index with min constraint (at least 30 days before)
        # Should count p1 (30 days) + p2 (30 days) = 60 days
        t8 = {
            "name": "count_days_before_min30",
            "persons": ["P1", "P2"],
            "values": [60, 30],
        }

        # Test 9: date_range with only max_date, cutoff in middle of p2 (Mar1-Mar30)
        # max_date=BeforeOrOn("2020-03-15") clips END_DATE of p2 to Mar15
        # p1: Jan1-Jan30 fully inside → 30 days
        # p2: Mar1-Mar30 → END clipped to Mar15 → Mar1-Mar15 = 15 days
        # p3/p4/p5: START_DATE > Mar15 → after clip END=Mar15, START>END → excluded
        # P1: 30 + 15 = 45 days, P2: 30 days (only has p1)
        t9 = {
            "name": "date_range_max_end_date",
            "persons": ["P1", "P2"],
            "values": [45, 30],
        }

        # Test 10: date_range with only min_date, cutoff in middle of p4 (Jul1-Jul30)
        # min_date=AfterOrOn("2020-07-15") clips START_DATE of p4 to Jul15
        # p1/p2/p3: END_DATE < Jul15 → after clip START=Jul15, START>END → excluded
        # p4: Jul1-Jul30 → START clipped to Jul15 → Jul15-Jul30 = 16 days
        # p5: Sep1-Sep30 fully inside → 30 days
        # P1: 16 + 30 = 46 days, P2: 0 days
        t10 = {
            "name": "date_range_min_start_date",
            "persons": ["P1", "P2"],
            "values": [46, 0],
        }

        # Test 11: date_range with both min_date and max_date, each cutting inside a period
        # min_date=AfterOrOn("2020-03-15"), max_date=BeforeOrOn("2020-07-15")
        # p1: END=Jan30 < Mar15 → after clip START=Mar15, START>END → excluded
        # p2: Mar1-Mar30 → START clipped to Mar15 → Mar15-Mar30 = 16 days
        # p3: May1-May30 fully inside → 30 days
        # p4: Jul1-Jul30 → END clipped to Jul15 → Jul1-Jul15 = 15 days
        # p5: START=Sep1 > Jul15 → after clip END=Jul15, START>END → excluded
        # P1: 16 + 30 + 15 = 61 days, P2: 0 days (p1 excluded)
        t11 = {
            "name": "date_range_combined_start_and_end",
            "persons": ["P1", "P2"],
            "values": [61, 0],
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11]

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
                min_days=GreaterThanOrEqualTo(30),  # At least 30 days after index
            ),
        )

        t5["phenotype"] = TimeRangeDayCountPhenotype(
            name=t5["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                max_days=LessThanOrEqualTo(90),  # Up to 90 days after index
            ),
        )

        t6["phenotype"] = TimeRangeDayCountPhenotype(
            name=t6["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                when="after",
                min_days=GreaterThanOrEqualTo(30),  # At least 30 days after
                max_days=LessThanOrEqualTo(90),  # Up to 90 days after
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
                min_days=GreaterThanOrEqualTo(30),  # At least 30 days before index
            ),
        )

        t9["phenotype"] = TimeRangeDayCountPhenotype(
            name=t9["name"],
            domain="VISIT_OCCURRENCE",
            date_range=DateFilter(
                max_date=BeforeOrOn("2020-03-15"),
            ),
        )

        t10["phenotype"] = TimeRangeDayCountPhenotype(
            name=t10["name"],
            domain="VISIT_OCCURRENCE",
            date_range=DateFilter(
                min_date=AfterOrOn("2020-07-15"),
            ),
        )

        t11["phenotype"] = TimeRangeDayCountPhenotype(
            name=t11["name"],
            domain="VISIT_OCCURRENCE",
            date_range=DateFilter(
                min_date=AfterOrOn("2020-03-15"),
                max_date=BeforeOrOn("2020-07-15"),
            ),
        )

        return test_infos


def test_time_range_day_count_phenotypes():
    """Test basic time range day counting functionality."""
    spg = TimeRangeDayCountPhenotypeTestGenerator()
    spg.run_tests()


class TimeRangeDayCountDeathAnchorTestGenerator(PhenotypeTestGenerator):
    """
    Tests TimeRangeDayCountPhenotype with two relative time ranges applied in
    sequence: after index AND before death.

    5 patients with the same 5 visit periods (p1–p5). 2 of 5 have death after
    index; 1 has death before index; 2 have no death.

    Expected window per patient (periods after index, clipped to death date):
      P1 (death 2020-09-15): p3→May15-May30 (16d) + p4→Jul1-Jul30 (30d)
                             + p5→Sep1-Sep15 (15d) = 61d
      P2 (death 2020-07-15): p3→May15-May30 (16d) + p4→Jul1-Jul15 (15d) = 31d
      P3 (death 2020-03-15, before index): intersection of (after index) and
                             (before Mar15) is empty → 0d
      P4, P5 (no death): null anchor → "before death" applies no upper bound
                         → same as after-index only: 16 + 30 + 30 = 76d
    """

    name_space = "trdcda"
    test_values = True

    def define_input_tables(self):
        all_persons = ["P1", "P2", "P3", "P4", "P5"]
        death_dates = [
            datetime.date(2020, 9, 15),  # P1: death after index
            datetime.date(2020, 7, 15),  # P2: death after index
            datetime.date(2020, 3, 15),  # P3: death before index
            None,  # P4: no death
            None,  # P5: no death
        ]

        df_person = pd.DataFrame(
            {
                "PERSON_ID": all_persons,
                "INDEX_DATE": [INDEX] * 5,
                "DATE_OF_DEATH": death_dates,
            }
        )

        visit_rows = [
            {"PERSON_ID": pid, "START_DATE": start, "END_DATE": end}
            for pid in all_persons
            for start, end in [
                (p1_START, p1_END),
                (p2_START, p2_END),
                (p3_START, p3_END),
                (p4_START, p4_END),
                (p5_START, p5_END),
            ]
        ]
        df_visit = pd.DataFrame(visit_rows).merge(
            df_person[["PERSON_ID", "INDEX_DATE"]], on="PERSON_ID"
        )

        return [
            {"name": "PERSON", "df": df_person},
            {"name": "VISIT_OCCURRENCE", "df": df_visit},
        ]

    def define_phenotype_tests(self):
        death_phenotype = DeathPhenotype(name="death_anchor")

        t = {
            "name": "count_days_after_index_before_death",
            "persons": ["P1", "P2", "P3", "P4", "P5"],
            "values": [61, 31, 0, 76, 76],
        }
        t["phenotype"] = TimeRangeDayCountPhenotype(
            name=t["name"],
            domain="VISIT_OCCURRENCE",
            relative_time_range=[
                RelativeTimeRangeFilter(when="after"),
                RelativeTimeRangeFilter(
                    when="before", anchor_phenotype=death_phenotype
                ),
            ],
        )
        return [t]


def test_time_range_day_count_with_death_anchor():
    """Test time range day counting bounded by death phenotype as upper anchor."""
    TimeRangeDayCountDeathAnchorTestGenerator().run_tests()


if __name__ == "__main__":
    test_time_range_day_count_phenotypes()
    test_time_range_day_count_with_death_anchor()
