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


class CodelistPhenotypeReturnDateFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "clpt_return_date"

    def define_input_tables(self):
        min_days = datetime.timedelta(days=90)
        max_days = datetime.timedelta(days=180)
        one_day = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)

        self.event_dates = [
            index_date - min_days - one_day,  # P0  c1  0
            index_date - min_days,  # P1  c1  1
            index_date - min_days + one_day,  # P2  c1  2
            index_date - min_days - one_day,  # P0  c2  3
            index_date - min_days,  # P1  c2  4
            index_date - min_days + one_day,  # P2  c2  5
            index_date + min_days - one_day,  # P0  c1  6
            index_date + min_days,  # P1  c1  7
            index_date + min_days + one_day,  # P2  c1  8
            index_date + min_days - one_day,  # P0  c2  9
            index_date + min_days,  # P1  c2  10
            index_date + min_days + one_day,  # P2  c2  11
        ]

        """

                                    idx

                    -min_days                           +min_days
                       1                                    7
                       4                                    10
        -min_days-1         -min_days+1     +min_days-1         +min_days+1
            0                   2               6                   8
            3                   5               9                   11
        """
        N = len(self.event_dates)

        df = pd.DataFrame.from_dict(
            {
                "CODE": ["c1"] * 3 + ["c2"] * 3 + ["c1"] * 3 + ["c2"] * 3,
                "PERSON_ID": [f"P0" for x in list(range(N))],
                "CODE_TYPE": ["ICD10CM"] * N,
                "INDEX_DATE": [index_date] * N,
                "EVENT_DATE": self.event_dates,
            }
        )

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        t1 = {
            "name": "returndate",
            "return_date": "all",
            "persons": ["P0", "P0", "P0"] * 2,
            "dates": self.event_dates[:3] + self.event_dates[6:9],
        }

        t2 = {
            "name": "l90",
            "return_date": "all",
            "persons": ["P0"],
            "dates": [self.event_dates[2]],
            "relative_time_range": RelativeTimeRangeFilter(max_days=LessThan(90)),
        }

        t3 = {
            "name": "leq90",
            "return_date": "all",
            "persons": ["P0", "P0"],
            "dates": self.event_dates[1:3],
            "relative_time_range": RelativeTimeRangeFilter(
                max_days=LessThanOrEqualTo(90)
            ),
        }

        t4 = {
            "name": "first_preindex",
            "return_date": "first",
            "persons": ["P0"],
            "dates": [self.event_dates[0]],
        }

        t5 = {
            "name": "last_preindex",
            "return_date": "last",
            "persons": ["P0"],
            "dates": [self.event_dates[2]],
            "relative_time_range": RelativeTimeRangeFilter(when="before"),
        }

        t6 = {
            "name": "first_leq90",
            "return_date": "first",
            "persons": ["P0"],
            "dates": [self.event_dates[1]],
            "relative_time_range": RelativeTimeRangeFilter(
                max_days=LessThanOrEqualTo(90)
            ),
        }

        # POST INDEX TESTS
        t7 = {
            "name": "last_postindex",
            "return_date": "last",
            "persons": ["P0"],
            "dates": [self.event_dates[8]],
            "relative_time_range": RelativeTimeRangeFilter(when="after"),
        }

        t8 = {
            "name": "first_postindex",
            "return_date": "first",
            "persons": ["P0"],
            "dates": [self.event_dates[6]],
            "relative_time_range": RelativeTimeRangeFilter(when="after"),
        }

        t9 = {
            "name": "postindex_leq90",
            "return_date": "all",
            "persons": ["P0", "P0"],
            "dates": [self.event_dates[6], self.event_dates[7]],
            "relative_time_range": RelativeTimeRangeFilter(
                when="after", max_days=LessThanOrEqualTo(90)
            ),
        }

        # TODO implement nearest

        t10 = {
            "name": "nearest_prior",
            "return_date": "nearest",
            "persons": ["P0"],
            "dates": [self.event_dates[2]],
            "relative_time_range": RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        }

        t11 = {
            "name": "nearest_all",
            "return_date": "nearest",
            "persons": ["P0"],
            "dates": [self.event_dates[2]],
            "relative_time_range": RelativeTimeRangeFilter(
                when="before", max_days=LessThanOrEqualTo(1000)
            ),
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7, t8, t9]  # , t10, t11]
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        for test_info in test_infos:
            test_info["column_types"] = {f"{test_info['name']}_date": "date"}

            test_info["phenotype"] = CodelistPhenotype(
                name=test_info["name"],
                domain="CONDITION_OCCURRENCE",
                codelist=codelist_factory.get_codelist("c1"),
                relative_time_range=test_info.get("relative_time_range"),
                return_date=test_info["return_date"],
            )

        return test_infos


def test_codelist_phenotype():
    tg = CodelistPhenotypeReturnDateFilterTestGenerator()
    tg.run_tests()
