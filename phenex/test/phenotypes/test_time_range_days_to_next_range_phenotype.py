import datetime
import pandas as pd
from typing import List, Dict

from phenex.phenotypes.time_range_days_to_next_range_phenotype import TimeRangeDaysToNextRange
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.filters import RelativeTimeRangeFilter, Value, ValueFilter
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import GreaterThan, LessThan, EqualTo

class TimeRangeDaysToNextRangePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "trdtnrp"
    test_values = True
    test_date = True

    def define_input_tables(self) -> List[Dict]:
        index_date = datetime.date(2022, 1, 15)
        oneday = datetime.timedelta(days=1)

        # 4 Persons
        # P1: Has anchor range, and one next range. Gap 10 days.
        # P2: Has anchor range, and two future ranges. Closest gap 20 days.
        # P3: Has anchor range, no future range.
        # P4: Has no anchor range (ranges do not overlap index).

        # Anchor Range for P1, P2, P3: 2022-01-01 to 2022-01-30. Includes 2022-01-15.
        anchor_start = datetime.date(2022, 1, 1)
        anchor_end = datetime.date(2022, 1, 30)
        
        # P1 Next Range: Starts 2022-02-09 (10 days after Jan 30).
        p1_next_start = anchor_end + datetime.timedelta(days=10)
        p1_next_end = p1_next_start + datetime.timedelta(days=5)

        # P2 Next Range 1: Starts 20 days after Jan 30.
        p2_next_start_1 = anchor_end + datetime.timedelta(days=20)
        p2_next_end_1 = p2_next_start_1 + datetime.timedelta(days=5)
        
        # P2 Next Range 2: Starts 40 days after Jan 30.
        p2_next_start_2 = anchor_end + datetime.timedelta(days=40)
        p2_next_end_2 = p2_next_start_2 + datetime.timedelta(days=5)
        
        # P4 Range: 2021-01-01 to 2021-01-30. Way before index.
        p4_prior_end = anchor_start - datetime.timedelta(days=40)
        p4_prior_start = p4_prior_end - datetime.timedelta(days=10)

        visit_data = [
            # P1
            {"PERSON_ID": "P1", "START_DATE": anchor_start, "END_DATE": anchor_end},
            {"PERSON_ID": "P1", "START_DATE": p1_next_start, "END_DATE": p1_next_end},
            # P2
            {"PERSON_ID": "P2", "START_DATE": anchor_start, "END_DATE": anchor_end},
            {"PERSON_ID": "P2", "START_DATE": p2_next_start_1, "END_DATE": p2_next_end_1},
            {"PERSON_ID": "P2", "START_DATE": p2_next_start_2, "END_DATE": p2_next_end_2},
            # P3
            {"PERSON_ID": "P3", "START_DATE": anchor_start, "END_DATE": anchor_end},
            # P4
            {"PERSON_ID": "P4", "START_DATE": datetime.date(2021, 1, 1), "END_DATE": datetime.date(2021, 1, 30)},
            {"PERSON_ID": "P5", "START_DATE": anchor_start, "END_DATE": anchor_end},
            {"PERSON_ID": "P5", "START_DATE": p4_prior_start, "END_DATE": p4_prior_end},

        ]
        
        df_visit = pd.DataFrame(visit_data)

        df_visit['INDEX_DATE'] = index_date
        
        # Anchor Phenotype Table (Condition Occurrence)
        # Everyone gets an anchor event at index_date
        df_condition = pd.DataFrame({
            "PERSON_ID": ["P1", "P2", "P3", "P4"],
            "CODE": ["A"] * 4,
            "CODE_TYPE": ["ICD10"] * 4,
            "EVENT_DATE": [index_date] * 4,
        })

        return [
            {"name": "VISIT_OCCURRENCE", "df": df_visit},
            {"name": "CONDITION_OCCURRENCE", "df": df_condition}
        ]

    def define_phenotype_tests(self):
        # Anchor phenotype
        entry = CodelistPhenotype(
            name="entry",
            codelist=Codelist(name="A", codelist={"ICD10": ["A"]}),
            domain="CONDITION_OCCURRENCE"
        )

        anchor_end = datetime.date(2022, 1, 30)
        anchor_start = datetime.date(2022, 1, 1)
        p1_next_start = anchor_end + datetime.timedelta(days=10)
        p2_next_start = anchor_end + datetime.timedelta(days=20)
        p4_prior_end = anchor_start - datetime.timedelta(days=40)

        # Test 1: Basic functionality
        # Expect P1: Value=10, Date=p1_next_start
        # Expect P2: Value=20, Date=p2_next_start_1 (closest)
        # P3 excluded (no next)
        # P4 excluded (no anchor range)
        t1 = {
            "name": "gap_to_next",
            "phenotype": TimeRangeDaysToNextRange(
                name="gap_to_next",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when='after'
                )
            ),
            "persons": ["P1", "P2"],
            "values": [10, 20],
            "dates": [p1_next_start, p2_next_start]
        }
        
        # Test 2: With Value Filter (Gap > 15 days)
        # Should only return P2
        t2 = {
            "name": "gap_gt_15",
            "phenotype": TimeRangeDaysToNextRange(
                name="gap_gt_15",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when='after'
                ),
                value_filter=ValueFilter(
                    min_value=GreaterThan(15)
                )
            ),
            "persons": ["P2"],
            "values": [20],
            "dates": [p2_next_start]
        }

        # Test 3: with when = 'before ie looking for size of gap to prior range
        # Should return P5 only
        t3 = {
            "name": "prior_gap",
            "phenotype": TimeRangeDaysToNextRange(
                name="prior_gap",
                domain="VISIT_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when='before'
                ),
                # value_filter=ValueFilter(
                #     min_value=GreaterThan(15)
                # )
            ),
            "persons": ["P5"],
            "values": [40],
            "dates": [p4_prior_end]
        }
        return [t1, t2, t3]

def test_time_range_days_to_next_range():
    spg = TimeRangeDaysToNextRangePhenotypeTestGenerator()
    spg.run_tests()

if __name__ == "__main__":
    test_time_range_days_to_next_range()
