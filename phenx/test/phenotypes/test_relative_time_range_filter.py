import datetime, os
import pandas as pd

from phenx.phenotypes.codelist_phenotype import CodelistPhenotype
from phenx.codelists import LocalCSVCodelistFactory
from phenx.filters.date_range_filter import DateRangeFilter
from phenx.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenx.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenx.test.phenotype_test_generator import PhenotypeTestGenerator
from phenx.filters.value import (
    GreaterThan,
    GreaterThanOrEqualTo,
    LessThan,
    LessThanOrEqualTo,
    EqualTo,
)


class CodelistPhenotypeRelativeTimeRangeFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "clpt_timerangefilter"

    def define_input_tables(self):
        min_days = datetime.timedelta(days=90)
        max_days = datetime.timedelta(days=180)
        one_day = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)

        event_dates = [
            index_date - min_days - one_day,  # P0
            index_date - min_days,  # P1
            index_date - min_days + one_day,  # P2
            index_date - max_days - one_day,  # P3
            index_date - max_days,  # P4
            index_date - max_days + one_day,  # P5
            index_date - one_day,  # P6
            index_date,  # P7
            index_date + one_day,  # P8
            index_date + min_days + one_day,  # P9
            index_date + min_days,  # P10
            index_date + min_days - one_day,  # P11
            index_date + max_days + one_day,  # P12
            index_date + max_days,  # P13
            index_date + max_days - one_day,  # P14
        ]
        N = len(event_dates)

        df = pd.DataFrame.from_dict(
            {
                "CODE": ["c1"] * N,
                "PERSON_ID": [f"P{x}" for x in list(range(N))],
                "CODE_TYPE": ["ICD10CM"] * N,
                "INDEX_DATE": [index_date] * N,
                "EVENT_DATE": event_dates,
            }
        )

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        t1 = {
            "name": "max_days_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                max_days=LessThanOrEqualTo(180)
            ),
            "persons": ["P0", "P1", "P2", "P4", "P5", "P6", "P7"],
        }
        t2 = {
            "name": "max_days_lt_180",
            "relative_time_range": RelativeTimeRangeFilter(max_days=LessThan(180)),
            "persons": ["P0", "P1", "P2", "P5", "P6", "P7"],
        }
        t3 = {
            "name": "min_days_geq_90_max_days_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(90),
                max_days=LessThanOrEqualTo(180),
            ),
            "persons": ["P0", "P1", "P4", "P5"],
        }

        t4 = {
            "name": "after_max_days_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                max_days=LessThanOrEqualTo(180), when="after"
            ),
            "persons": [
                "P7",
                "P8",
                "P9",
                "P10",
                "P11",
                "P13",
                "P14",
            ],  # P12 is maxdays + 1day, so outside of range
        }

        t5 = {
            "name": "after_max_days_g_90_max_days_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(90),
                max_days=LessThanOrEqualTo(180),
                when="after",
            ),
            "persons": ["P9", "P13", "P14"],
        }

        t6 = {
            "name": "range_min_gn90_max_g90",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(-90), max_days=LessThan(90), when="after"
            ),
            "persons": ["P2", "P6", "P7", "P8", "P11"],
        }

        t7 = {
            "name": "range_min_gn90_max_ge180",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(-90),
                max_days=LessThanOrEqualTo(180),
                when="after",
            ),
            "persons": ["P2", "P6", "P7", "P8", "P9", "P10", "P11", "P13", "P14"],
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7]
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        for test_info in test_infos:
            test_info["phenotype"] = CodelistPhenotype(
                name=test_info["name"],
                codelist=codelist_factory.get_codelist("c1"),
                domain="CONDITION_OCCURRENCE",
                relative_time_range=test_info["relative_time_range"],
            )

        return test_infos


def test_codelist_phenotype():
    tg = CodelistPhenotypeRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()
