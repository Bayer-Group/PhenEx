import os
import datetime

import pandas as pd

from phenex.phenotypes.event_phenotype import EventPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_filter import DateFilter, After, AfterOrOn, Before, BeforeOrOn
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import (
    GreaterThan,
    GreaterThanOrEqualTo,
    LessThan,
    LessThanOrEqualTo,
)
from phenex.tables import EventTable


# ---------------------------------------------------------------------------
# Basic: all events are returned (no filtering)
# ---------------------------------------------------------------------------


class EventPhenotypeBasicTestGenerator(PhenotypeTestGenerator):
    name_space = "evpt_basic"

    def define_input_tables(self):
        index_date = datetime.date(2022, 1, 1)
        persons = ["P1", "P2", "P3", "P4"]
        df = pd.DataFrame(
            {
                "PERSON_ID": persons,
                "EVENT_DATE": [index_date - datetime.timedelta(days=10)] * 4,
                "INDEX_DATE": [index_date] * 4,
            }
        )
        return [{"name": "events", "df": df, "type": EventTable}]

    def define_phenotype_tests(self):
        t1 = {
            "name": "all_events",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": EventPhenotype(name="all_events", domain="events"),
        }
        return [t1]


# ---------------------------------------------------------------------------
# Relative time range filtering (mirrors CodelistPhenotypeRelativeTimeRangeFilterTestGenerator)
# ---------------------------------------------------------------------------


class EventPhenotypeRelativeTimeRangeFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "evpt_timerangefilter"

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
        df = pd.DataFrame(
            {
                "PERSON_ID": [f"P{x}" for x in range(N)],
                "EVENT_DATE": event_dates,
                "INDEX_DATE": [index_date] * N,
            }
        )
        return [{"name": "events", "df": df, "type": EventTable}]

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
            "persons": ["P7", "P8", "P9", "P10", "P11", "P13", "P14"],
        }
        t5 = {
            "name": "after_min_gt_90_max_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(90),
                max_days=LessThanOrEqualTo(180),
                when="after",
            ),
            "persons": ["P9", "P13", "P14"],
        }
        t6 = {
            "name": "range_min_gn90_max_l90",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(-90), max_days=LessThan(90), when="after"
            ),
            "persons": ["P2", "P6", "P7", "P8", "P11"],
        }
        t7 = {
            "name": "range_min_gn90_max_leq180",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(-90),
                max_days=LessThanOrEqualTo(180),
                when="after",
            ),
            "persons": ["P2", "P6", "P7", "P8", "P9", "P10", "P11", "P13", "P14"],
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7]
        for test_info in test_infos:
            test_info["phenotype"] = EventPhenotype(
                name=test_info["name"],
                domain="events",
                relative_time_range=test_info["relative_time_range"],
            )
        return test_infos


# ---------------------------------------------------------------------------
# Date range filtering
# ---------------------------------------------------------------------------


class EventPhoenotypeDateRangeFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "evpt_daterangefilter"
    test_date = True

    def define_input_tables(self):
        one_day = datetime.timedelta(days=1)
        cutoff = datetime.date(2022, 6, 1)

        self.event_dates = [
            cutoff - 2 * one_day,  # P0 - before cutoff
            cutoff - one_day,  # P1 - day before cutoff
            cutoff,  # P2 - on cutoff
            cutoff + one_day,  # P3 - day after cutoff
            cutoff + 2 * one_day,  # P4 - after cutoff
        ]
        N = len(self.event_dates)
        df = pd.DataFrame(
            {
                "PERSON_ID": [f"P{x}" for x in range(N)],
                "EVENT_DATE": self.event_dates,
                "INDEX_DATE": [datetime.date(2022, 1, 1)] * N,
            }
        )
        return [{"name": "events", "df": df, "type": EventTable}]

    def define_phenotype_tests(self):
        cutoff = datetime.date(2022, 6, 1)

        t1 = {
            "name": "before_cutoff",
            "date_range": DateFilter(max_date=Before(cutoff)),
            "persons": ["P0", "P1"],
            "dates": [self.event_dates[0], self.event_dates[1]],
        }
        t2 = {
            "name": "before_or_on_cutoff",
            "date_range": DateFilter(max_date=BeforeOrOn(cutoff)),
            "persons": ["P0", "P1", "P2"],
            "dates": [self.event_dates[0], self.event_dates[1], self.event_dates[2]],
        }
        t3 = {
            "name": "after_cutoff",
            "date_range": DateFilter(min_date=After(cutoff)),
            "persons": ["P3", "P4"],
            "dates": [self.event_dates[3], self.event_dates[4]],
        }
        t4 = {
            "name": "after_or_on_cutoff",
            "date_range": DateFilter(min_date=AfterOrOn(cutoff)),
            "persons": ["P2", "P3", "P4"],
            "dates": [self.event_dates[2], self.event_dates[3], self.event_dates[4]],
        }

        one_day = datetime.timedelta(days=1)
        t5 = {
            "name": "window",
            "date_range": DateFilter(
                min_date=AfterOrOn(cutoff - one_day),
                max_date=BeforeOrOn(cutoff + one_day),
            ),
            "persons": ["P1", "P2", "P3"],
            "dates": [self.event_dates[1], self.event_dates[2], self.event_dates[3]],
        }

        test_infos = [t1, t2, t3, t4, t5]
        for test_info in test_infos:
            test_info["phenotype"] = EventPhenotype(
                name=test_info["name"],
                domain="events",
                date_range=test_info["date_range"],
            )
        return test_infos


# ---------------------------------------------------------------------------
# return_date: first / last / all
# ---------------------------------------------------------------------------


class EventPhenotypeReturnDateTestGenerator(PhenotypeTestGenerator):
    name_space = "evpt_return_date"

    def define_input_tables(self):
        one_day = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)
        min_days = datetime.timedelta(days=90)

        # Three events pre-index, three post-index, all for the same patient P0
        self.event_dates = [
            index_date - min_days - one_day,  # 0  earliest pre
            index_date - min_days,  # 1
            index_date - min_days + one_day,  # 2  latest pre
            index_date + min_days - one_day,  # 3  earliest post
            index_date + min_days,  # 4
            index_date + min_days + one_day,  # 5  latest post
        ]
        N = len(self.event_dates)
        df = pd.DataFrame(
            {
                "PERSON_ID": ["P0"] * N,
                "EVENT_DATE": self.event_dates,
                "INDEX_DATE": [index_date] * N,
            }
        )
        return [{"name": "events", "df": df, "type": EventTable}]

    def define_phenotype_tests(self):
        t_all = {
            "name": "all",
            "return_date": "all",
            "persons": ["P0"] * 6,
            "dates": self.event_dates,
        }
        t_first = {
            "name": "first",
            "return_date": "first",
            "persons": ["P0"],
            "dates": [self.event_dates[0]],
        }
        t_last = {
            "name": "last",
            "return_date": "last",
            "persons": ["P0"],
            "dates": [self.event_dates[5]],
        }
        t_first_pre = {
            "name": "first_pre",
            "return_date": "first",
            "relative_time_range": RelativeTimeRangeFilter(when="before"),
            "persons": ["P0"],
            "dates": [self.event_dates[0]],
        }
        t_last_pre = {
            "name": "last_pre",
            "return_date": "last",
            "relative_time_range": RelativeTimeRangeFilter(when="before"),
            "persons": ["P0"],
            "dates": [self.event_dates[2]],
        }
        t_first_post = {
            "name": "first_post",
            "return_date": "first",
            "relative_time_range": RelativeTimeRangeFilter(when="after"),
            "persons": ["P0"],
            "dates": [self.event_dates[3]],
        }
        t_last_post = {
            "name": "last_post",
            "return_date": "last",
            "relative_time_range": RelativeTimeRangeFilter(when="after"),
            "persons": ["P0"],
            "dates": [self.event_dates[5]],
        }

        test_infos = [
            t_all,
            t_first,
            t_last,
            t_first_pre,
            t_last_pre,
            t_first_post,
            t_last_post,
        ]
        for test_info in test_infos:
            test_info["column_types"] = {f"{test_info['name']}_date": "date"}
            test_info["phenotype"] = EventPhenotype(
                name=test_info["name"],
                domain="events",
                return_date=test_info["return_date"],
                relative_time_range=test_info.get("relative_time_range"),
            )
        return test_infos


# ---------------------------------------------------------------------------
# Anchor phenotype (EventPhenotype relative to a CodelistPhenotype anchor)
# ---------------------------------------------------------------------------


class EventPhenotypeAnchorPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "evpt_anchor_phenotype"
    test_date = True

    def define_input_tables(self):
        min_days = datetime.timedelta(days=90)
        index_date = datetime.date(2022, 1, 1)
        anchor_date = index_date + min_days  # anchor event at +90 days

        # anchor events (code c1) - one per patient at anchor_date
        N_patients = 5
        persons = [f"P{i}" for i in range(N_patients)]

        anchor_df = pd.DataFrame(
            {
                "PERSON_ID": persons,
                "CODE": ["c1"] * N_patients,
                "CODE_TYPE": ["ICD10CM"] * N_patients,
                "EVENT_DATE": [anchor_date] * N_patients,
                "INDEX_DATE": [index_date] * N_patients,
            }
        )

        one_day = datetime.timedelta(days=1)
        # Events relative to anchor_date (one event per patient at varying offsets)
        event_offsets = [
            -2 * min_days,  # P0: 180 days before anchor
            -min_days,  # P1: 90 days before anchor
            -one_day,  # P2: 1 day before anchor
            one_day,  # P3: 1 day after anchor
            min_days,  # P4: 90 days after anchor
        ]
        self.event_dates = [anchor_date + offset for offset in event_offsets]

        events_df = pd.DataFrame(
            {
                "PERSON_ID": persons,
                "EVENT_DATE": self.event_dates,
                "INDEX_DATE": [index_date] * N_patients,
            }
        )

        return [
            {"name": "CONDITION_OCCURRENCE", "df": anchor_df},
            {"name": "events", "df": events_df, "type": EventTable},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            path=os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        anchor_phenotype = CodelistPhenotype(
            name="anchor",
            codelist=codelist_factory.get_codelist("c1"),
            domain="CONDITION_OCCURRENCE",
            return_date="first",
        )

        # Events that occur within 90 days after the anchor
        t1 = {
            "name": "after_anchor_leq90",
            "persons": ["P3", "P4"],
            "dates": [self.event_dates[3], self.event_dates[4]],
            "phenotype": EventPhenotype(
                name="after_anchor_leq90",
                domain="events",
                relative_time_range=RelativeTimeRangeFilter(
                    anchor_phenotype=anchor_phenotype,
                    max_days=LessThanOrEqualTo(90),
                    when="after",
                ),
            ),
        }

        # Events that occur within 90 days before the anchor (P1=90 days, P2=1 day)
        t2 = {
            "name": "before_anchor_leq90",
            "persons": ["P1", "P2"],
            "dates": [self.event_dates[1], self.event_dates[2]],
            "phenotype": EventPhenotype(
                name="before_anchor_leq90",
                domain="events",
                relative_time_range=RelativeTimeRangeFilter(
                    anchor_phenotype=anchor_phenotype,
                    max_days=LessThanOrEqualTo(90),
                    when="before",
                ),
            ),
        }

        # Events more than 90 days before the anchor (P0=180 days; P1=exactly 90 is excluded)
        t3 = {
            "name": "before_anchor_gt90",
            "persons": ["P0"],
            "dates": [self.event_dates[0]],
            "phenotype": EventPhenotype(
                name="before_anchor_gt90",
                domain="events",
                relative_time_range=RelativeTimeRangeFilter(
                    anchor_phenotype=anchor_phenotype,
                    min_days=GreaterThan(90),
                    when="before",
                ),
            ),
        }

        return [t1, t2, t3]


# ---------------------------------------------------------------------------
# Test functions
# ---------------------------------------------------------------------------


def test_event_phenotype_basic():
    tg = EventPhenotypeBasicTestGenerator()
    tg.run_tests()


def test_event_phenotype_relative_time_range():
    tg = EventPhenotypeRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()


def test_event_phenotype_date_range():
    tg = EventPhoenotypeDateRangeFilterTestGenerator()
    tg.run_tests()


def test_event_phenotype_return_date():
    tg = EventPhenotypeReturnDateTestGenerator()
    tg.run_tests()


def test_event_phenotype_anchor_phenotype():
    tg = EventPhenotypeAnchorPhenotypeTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_event_phenotype_basic()
    test_event_phenotype_relative_time_range()
    test_event_phenotype_date_range()
    test_event_phenotype_return_date()
    test_event_phenotype_anchor_phenotype()
