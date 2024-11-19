import datetime, os
import pandas as pd

from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_range_filter import DateRangeFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class CodelistPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "clpt"

    def define_input_tables(self):
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )
        df2 = pd.DataFrame(df).head()
        df2.loc[:, "EVENT_DATE"] = datetime.datetime.strptime("10-10-2021", "%m-%d-%Y")
        df = pd.concat([df, df2])
        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        c1 = {
            "name": "c1",
            "persons": ["P1", "P2", "P3", "P4"],
        }
        c2 = {"name": "c2", "persons": ["P1", "P2", "P5", "P6"]}

        c3 = {"name": "c3", "persons": ["P1", "P3", "P5", "P7"]}

        c1c2 = {"name": "c1c2", "persons": ["P1", "P2", "P3", "P4", "P5", "P6"]}

        c1c3 = {"name": "c1c3", "persons": ["P1", "P2", "P3", "P4", "P5", "P7"]}

        c2c3 = {"name": "c2c3", "persons": ["P1", "P2", "P3", "P5", "P6", "P7"]}

        c1c2c3 = {
            "name": "c1c2c3",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6", "P7"],
        }

        test_infos = [c1, c2, c3, c1c2, c1c3, c2c3, c1c2c3]
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        for test_info in test_infos:
            test_info["phenotype"] = CodelistPhenotype(
                codelist=codelist_factory.get_codelist(test_info["name"]),
                domain="CONDITION_OCCURRENCE",
            )
        return test_infos


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


class CodelistPhenotypeAnchorPhenotypeRelativeTimeRangeFilterTestGenerator(
    PhenotypeTestGenerator
):
    name_space = "clpt_anchor_phenotype"

    def define_input_tables(self):
        """
        want to test eg breast cancer pre index, gives the anchor date, code before breast cancer
        time component phenotype 1 : anchor date is index date
        time component phenotype 2 : anchor date is phenotype 1
        """
        min_days = datetime.timedelta(days=90)
        max_days = datetime.timedelta(days=180)
        index_date = datetime.date(2022, 1, 1)

        dates = [
            # phenotype 1 before index
            index_date - max_days,
            index_date - min_days,  # pass
            index_date,
            index_date + min_days,
            index_date + max_days,
        ]

        phenotype1_eventdates = []
        phenotype2_eventdates = []

        pids = []
        i = 0
        daysdif_p1 = []
        daysdif_p2 = []

        for phenotype1_eventdate in dates:
            phenotype1_eventdates += [phenotype1_eventdate] * 5
            daysdif_p1 += [0] * 5

            new = []
            new.append(phenotype1_eventdate - max_days)
            new.append(phenotype1_eventdate - min_days)
            new.append(phenotype1_eventdate)
            new.append(phenotype1_eventdate + min_days)
            new.append(phenotype1_eventdate + max_days)

            daysdif_p2 += [(x - phenotype1_eventdate).days for x in new]
            phenotype2_eventdates += new

            for _unused in range(5):
                pids.append(f"P{i}")
                i += 1

        N = len(phenotype1_eventdates) + len(phenotype2_eventdates)

        df = pd.DataFrame.from_dict(
            {
                "CODE": ["c1"] * len(phenotype1_eventdates)
                + ["c2"] * len(phenotype2_eventdates),
                "PERSON_ID": pids + pids,
                "CODE_TYPE": ["ICD10CM"] * N,
                "INDEX_DATE": [index_date] * N,
                "EVENT_DATE": phenotype1_eventdates + phenotype2_eventdates,
                "days_from_anchor": daysdif_p1 + daysdif_p2,
            }
        )

        df["days_from_index"] = [
            y.days
            for y in (
                [x - index_date for x in phenotype1_eventdates]
                + [x - index_date for x in phenotype2_eventdates]
            )
        ]

        info_input = {"name": "CONDITION_OCCURRENCE", "df": df}

        return [info_input]

    def define_phenotype_tests(self):
        # INDEX PHENOTYPES
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        phenotypeindex1 = CodelistPhenotype(
            name="anchor_g0_leq90",
            codelist=codelist_factory.get_codelist("c1"),
            domain="CONDITION_OCCURRENCE",
            return_date="last",
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThan(0),
                max_days=LessThanOrEqualTo(90),
            ),
        )

        phenotypeindex2 = CodelistPhenotype(
            name="anchor_ge0_leq180",
            codelist=codelist_factory.get_codelist("c1"),
            domain="CONDITION_OCCURRENCE",
            return_date="last",
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(0),
                max_days=LessThanOrEqualTo(180),
            ),
        )

        # second phenotype must occur any time prior to phenotype 1, but bounded within 1 year of index date

        #### USE INDEX PHENOTYEPS AS ANCHOR :

        phenotype1 = CodelistPhenotype(
            name="p1",
            codelist=codelist_factory.get_codelist("c2"),
            domain="CONDITION_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=phenotypeindex1,
                min_days=GreaterThanOrEqualTo(91),
            ),
        )

        t1 = {"name": "p1", "persons": ["P5"], "phenotype": phenotype1}

        phenotype2 = CodelistPhenotype(
            name="p2",
            codelist=codelist_factory.get_codelist("c2"),
            domain="CONDITION_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=phenotypeindex2,
                max_days=LessThanOrEqualTo(90),
            ),
        )

        t2 = {
            "name": "p2",
            "persons": [f"P{i}" for i in [1, 2, 6, 7, 11, 12]],
            "phenotype": phenotype2,
        }

        # Test that a baseline period works even with a linked time component.
        # the anchor event occurs at some period pre baseline
        # and we can add additional time components to the linked time component that ensures
        # the verification phenotype is also within the baseline period
        # phenotype3 = CodelistPhenotype(
        #     name="p3",
        #     codelist=codelist_factory.get_codelist("c2"),
        #     domain='CONDITION_OCCURRENCE',
        #     relative_time_range=[
        #         RelativeTimeRangeFilter(
        #             anchor_phenotype=phenotypeindex2,
        #             max_days=LessThanOrEqualTo(90),
        #         ),
        #         RelativeTimeRangeFilter(
        #             max_days=LessThan(180)
        #         ),  # ensure this event is within the baseline period
        #     ],
        # )
        # t3 = {"persons": [f"P{i}" for i in [7, 11, 12]], "phenotype": phenotype3}

        phenotype4 = CodelistPhenotype(
            name="p4",
            codelist=codelist_factory.get_codelist("c2"),
            domain="CONDITION_OCCURRENCE",
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=phenotypeindex2,
                min_days=GreaterThanOrEqualTo(-90),
                max_days=LessThanOrEqualTo(90),
            ),
        )

        t4 = {
            "name": "p4",
            "persons": [f"P{i}" for i in [1, 2, 3, 6, 7, 8, 11, 12, 13]],
            "phenotype": phenotype4,
        }

        test_infos = [t1, t2, t4]  # t3 # TODO implement list of relative time ranges

        return test_infos


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


def test_return_date():
    tg = CodelistPhenotypeReturnDateFilterTestGenerator()
    tg.run_tests()


def test_anchor_phenotype():
    tg = CodelistPhenotypeAnchorPhenotypeRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()


def test_relative_time_range_filter():
    tg = CodelistPhenotypeRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()


def test_codelist_phenotype():
    tg = CodelistPhenotypeTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_codelist_phenotype()
    # test_relative_time_range_filter()
    # test_anchor_phenotype()
    # test_return_date()
