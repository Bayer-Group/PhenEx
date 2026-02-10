import datetime, os
import pandas as pd

from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.codelists.codelists import Codelist
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *
from phenex.filters.categorical_filter import CategoricalFilter


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


from phenex.tables import CodeTable, PhenexTable


class DummyConditionOccurenceTable(CodeTable):
    NAME_TABLE = "DIAGNOSIS"
    JOIN_KEYS = {
        "DummyPersonTable": ["PERSON_ID"],
        "DummyEncounterTable": ["PERSON_ID", "ENCID"],  # I changed this from EVENT_DATE
    }
    PATHS = {"DummyVisitDetailTable": ["DummyEncounterTable"]}
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "DATE",
        "CODE": "CODE",
        "CODE_TYPE": "CODE_TYPE",
    }


class DummyEncounterTable(PhenexTable):
    NAME_TABLE = "ENCOUNTER"
    JOIN_KEYS = {
        "DummyPersonTable": ["PERSON_ID"],
        "DummyConditionOccurenceTable": [
            "PERSON_ID",
            "ENCID",
        ],
        "DummyVisitDetailTable": [
            "PERSON_ID",
            "VISITID",
        ],
    }
    DEFAULT_MAPPING = {"PERSON_ID": "PERSON_ID"}


class DummyVisitDetailTable(PhenexTable):
    NAME_TABLE = "VISIT"
    JOIN_KEYS = {
        "DummyPersonTable": ["PERSON_ID"],
        "DummyEncounterTable": ["PERSON_ID", "VISITID"],
    }
    DEFAULT_MAPPING = {"PERSON_ID": "PERSON_ID"}


class CodelistPhenotypeCategoricalFilterTestGenerator(PhenotypeTestGenerator):
    name_space = "clpt_categorical_filter"

    def define_input_tables(self):
        N = 10
        df = pd.DataFrame()
        df["PERSON_ID"] = [f"P{i}" for i in range(N)]
        df["ENCID"] = [f"E{i}" for i in range(N)]
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["DATE"] = datetime.datetime.strptime("10-10-2021", "%m-%d-%Y")

        df2 = pd.DataFrame()
        df2["PERSON_ID"] = [f"P{i}" for i in range(N)]
        df2["ENCID"] = [f"E{i}" for i in range(N)]
        df2["VISITID"] = [f"V{i}" for i in range(N)]
        df2["flag1"] = ["a"] * 2 + ["b"] * 2 + ["c"] * (N - 2 - 2)

        df3 = pd.DataFrame()
        df3["PERSON_ID"] = [f"P{i}" for i in range(N)]
        df3["VISITID"] = [f"V{i}" for i in range(N)]
        df3["flag2"] = ["d"] * 5 + ["e"] * 3 + ["f"] * (N - 5 - 3)

        return [
            {
                "name": "condition_occurrence",
                "df": df,
                "type": DummyConditionOccurenceTable,
            },
            {"name": "encounter", "df": df2, "type": DummyEncounterTable},
            {"name": "visit", "df": df3, "type": DummyVisitDetailTable},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c1a = {
            "name": "single_flag_direct_join_a",
            "persons": [f"P{i}" for i in range(2)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    allowed_values=["a"], column_name="flag1", domain="encounter"
                ),
            ),
        }

        c1b = {
            "name": "single_flag_direct_join_b",
            "persons": [f"P{i}" for i in range(2, 4)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    allowed_values=["b"], column_name="flag1", domain="encounter"
                ),
            ),
        }

        c2a = {
            "name": "single_flag_intermediary_join_a",
            "persons": [f"P{i}" for i in range(5)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    allowed_values=["d"], column_name="flag2", domain="visit"
                ),
            ),
        }

        c2b = {
            "name": "single_flag_intermediary_join_b",
            "persons": [f"P{i}" for i in range(5, 8)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    allowed_values=["e"], column_name="flag2", domain="visit"
                ),
            ),
        }

        test_infos = [c1a, c1b, c2a, c2b]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class CodelistPhenotypeCategoricalFilterLogicalCombinationsTestGenerator(
    PhenotypeTestGenerator
):
    name_space = "clpt_categorical_filter_logic"

    def define_input_tables(self):
        def add_flag(df, flag_name, flag_values):
            dfs = []
            for flag in flag_values:
                _df = df.copy()
                _df[flag_name] = flag
                dfs.append(_df)
            return pd.concat(dfs)

        df = pd.DataFrame()
        df["PERSON_ID"] = ["p1"]
        df["CODE"] = ["c1"]
        df["CODE_TYPE"] = ["ICD10CM"]
        df["EVENT_DATE"] = datetime.datetime.strptime("10-10-2021", "%m-%d-%Y")
        df = add_flag(df, "x", ["x1", "x2"])
        df = add_flag(df, "y", ["y1", "y2"])
        df = add_flag(df, "z", ["z1", "z2"])
        df["PERSON_ID"] = [f"P{i}" for i in range(df.shape[0])]
        self.df = df

        return [{"name": "condition_occurrence", "df": df, "column_types": {}}]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c1 = {
            "name": "single_flag",
            "persons": [f"P{i}" for i in range(4)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1"], column_name="z"
                ),
            ),
        }

        c2 = {
            "name": "two_categorical_filter_or",
            "persons": [f"P{i}" for i in range(4)] + [f"P{i}" for i in range(6, 8)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1"], column_name="z"
                )
                | CategoricalFilter(allowed_values=["y2"], column_name="y"),
            ),
        }

        c3 = {
            "name": "two_categorical_filter_and",
            "persons": [f"P{i}" for i in range(2, 4)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    allowed_values=["z1"], column_name="z"
                )
                & CategoricalFilter(allowed_values=["y2"], column_name="y"),
            ),
        }

        c4 = {
            "name": "four_categorical_filter",
            "persons": [f"P{i}" for i in range(2, 4)] + [f"P{i}" for i in range(6, 8)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=(
                    CategoricalFilter(allowed_values=["z1"], column_name="z")
                    & CategoricalFilter(allowed_values=["y2"], column_name="y")
                )
                | (
                    CategoricalFilter(allowed_values=["z2"], column_name="z")
                    & CategoricalFilter(allowed_values=["y2"], column_name="y")
                ),
            ),
        }

        c5 = {
            "name": "not_single_flag",
            "persons": [f"P{i}" for i in range(4, self.df.shape[0])],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=~CategoricalFilter(
                    allowed_values=["z1"], column_name="z"
                ),
            ),
        }

        test_infos = [c1, c2, c3, c4, c5]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class CodelistPhenotypeCategoricalFilterIsNullTestGenerator(PhenotypeTestGenerator):
    name_space = "clpt_categorical_filter_isnull"

    def define_input_tables(self):
        def add_flag(df, flag_name, flag_values):
            dfs = []
            for flag in flag_values:
                _df = df.copy()
                _df[flag_name] = flag
                dfs.append(_df)
            return pd.concat(dfs)

        df = pd.DataFrame()
        df["PERSON_ID"] = ["p1"]
        df["CODE"] = ["c1"]
        df["CODE_TYPE"] = ["ICD10CM"]
        df["EVENT_DATE"] = datetime.datetime.strptime("10-10-2021", "%m-%d-%Y")
        df = add_flag(df, "x", ["x1", "x2"])
        df = add_flag(df, "y", ["y1", "y2"])
        df = add_flag(df, "z", [None, "z2"])
        df["PERSON_ID"] = [f"P{i}" for i in range(df.shape[0])]
        df.iloc[0, 4] = None  # Set a single x1 to null!

        self.df = df

        return [{"name": "condition_occurrence", "df": df, "column_types": {}}]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c1 = {
            "name": "isnull",
            "persons": [f"P{i}" for i in range(4)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    column_name="z", operator="isnull"
                ),
            ),
        }

        c2 = {
            "name": "isnotnull",
            "persons": [f"P{i}" for i in range(4, 8)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    column_name="z", operator="notnull"
                ),
            ),
        }

        c3 = {
            "name": "notin_no_nulls",
            "persons": [f"P{i}" for i in [0, 1, 4, 5]],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    column_name="y", operator="notin", allowed_values=["y2"]
                ),
            ),
        }

        # this is the test to prove that "notin" removes null columns!
        c4 = {
            "name": "notin_with_null",
            "persons": [f"P{i}" for i in [2, 4, 6]],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(
                    column_name="x", operator="notin", allowed_values=["x2"]
                ),
            ),
        }

        c5 = {
            "name": "two_categorical_filter_or",
            "persons": [f"P{i}" for i in range(4)] + [f"P{i}" for i in range(6, 8)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(column_name="z", operator="isnull")
                | CategoricalFilter(allowed_values=["y2"], column_name="y"),
            ),
        }

        c6 = {
            "name": "two_categorical_filter_and",
            "persons": [f"P{i}" for i in range(2, 4)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=CategoricalFilter(column_name="z", operator="isnull")
                & CategoricalFilter(allowed_values=["y2"], column_name="y"),
            ),
        }

        c7 = {
            "name": "not_is_null",
            "persons": [f"P{i}" for i in range(4, self.df.shape[0])],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=~CategoricalFilter(
                    column_name="z", operator="isnull"
                ),
            ),
        }

        test_infos = [c1, c2, c3, c4, c5, c6, c7]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class CodelistPhenotypeFuzzyMatchTestGenerator(PhenotypeTestGenerator):
    name_space = "clpt_fuzzy_match"

    def define_input_tables(self):
        df = pd.DataFrame(
            {
                "PERSON_ID": ["P1", "P2", "P3", "P4", "P5", "P6"],
                "CODE": ["A123", "B456", "A789", "B012", "C123", "D785"],
                "CODE_TYPE": [
                    "ICD10CM",
                    "ICD10CM",
                    "ICD9CM",
                    "ICD9CM",
                    "ICD10CM",
                    "ICD9CM",
                ],
                "EVENT_DATE": [datetime.date(2021, 1, 1)] * 6,
            }
        )
        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        fuzzy_codelist_no_type = Codelist(["A%", "B%"], name="fuzzy_no_type")
        fuzzy_codelist_no_type_begin_end = Codelist(
            ["%78%"], name="fuzzy_codelist_no_type_begin_end"
        )
        fuzzy_codelist_with_type = Codelist(
            {"ICD10CM": ["A%"], "ICD9CM": ["B%"]}, name="fuzzy_with_type"
        )

        test1 = {
            "name": "fuzzy_no_type",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": CodelistPhenotype(
                codelist=fuzzy_codelist_no_type,
                domain="CONDITION_OCCURRENCE",
            ),
        }

        test2 = {
            "name": "fuzzy_with_type",
            "persons": ["P1", "P4"],
            "phenotype": CodelistPhenotype(
                codelist=fuzzy_codelist_with_type,
                domain="CONDITION_OCCURRENCE",
            ),
        }

        test3 = {
            "name": "fuzzy_no_type_begin_end",
            "persons": ["P3", "P6"],
            "phenotype": CodelistPhenotype(
                codelist=fuzzy_codelist_no_type_begin_end,
                domain="CONDITION_OCCURRENCE",
            ),
        }
        return [test1, test2, test3]


class CodelistPhenotypeCategoricalFilterLogicalCombinationsAutojoinTestGenerator(
    PhenotypeTestGenerator
):
    name_space = "clpt_categorical_filter_autojoin"

    def define_input_tables(self):
        N = 10
        df = pd.DataFrame()
        df["PERSON_ID"] = [f"P{i}" for i in range(N)]
        df["ENCID"] = [f"E{i}" for i in range(N)]
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["DATE"] = datetime.datetime.strptime("10-10-2021", "%m-%d-%Y")
        df["DX_POS"] = ["first"] * 5 + ["second"] * 5

        df2 = pd.DataFrame()
        df2["PERSON_ID"] = [f"P{i}" for i in range(N)]
        df2["ENCID"] = [f"E{i}" for i in range(N)]
        df2["VISITID"] = [f"V{i}" for i in range(N)]
        df2["flag1"] = ["a"] * 2 + ["b"] * 2 + ["c"] * (N - 2 - 2)

        df3 = pd.DataFrame()
        df3["PERSON_ID"] = [f"P{i}" for i in range(N)]
        df3["VISITID"] = [f"V{i}" for i in range(N)]
        df3["flag2"] = ["d"] * 5 + ["e"] * 3 + ["f"] * (N - 5 - 3)

        return [
            {
                "name": "condition_occurrence",
                "df": df,
                "type": DummyConditionOccurenceTable,
            },
            {"name": "encounter", "df": df2, "type": DummyEncounterTable},
            {"name": "visit", "df": df3, "type": DummyVisitDetailTable},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        a_cat_filter = CategoricalFilter(
            allowed_values=["a"], column_name="flag1", domain="encounter"
        )
        b_cat_filter = CategoricalFilter(
            allowed_values=["b"], column_name="flag1", domain="encounter"
        )

        c1 = {
            "name": "a_or_b_autojoin_table",
            "persons": [f"P{i}" for i in range(4)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=a_cat_filter | b_cat_filter,
            ),
        }

        primary_pos = CategoricalFilter(
            allowed_values=["first"],
            column_name="DX_POS",
            domain="condition_occurrence",
        )
        c2 = {
            "name": "a_and_primary_pos_autojoin_table",
            "persons": [f"P{i}" for i in range(2)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=a_cat_filter & primary_pos,
            ),
        }

        c3 = {
            "name": "a_and_primary_pos_or_b_autojoin_table",
            "persons": [f"P{i}" for i in range(4)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=(a_cat_filter & primary_pos) | b_cat_filter,
            ),
        }

        c_cat_filter = CategoricalFilter(
            allowed_values=["c"], column_name="flag1", domain="encounter"
        )
        c4 = {
            "name": "a_and_not_primary_pos_or_b_autojoin_table",
            "persons": [f"P{i}" for i in range(2, 4)] + [f"P{i}" for i in range(5, 10)],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                categorical_filter=(c_cat_filter & ~primary_pos) | b_cat_filter,
            ),
        }

        test_infos = [c1, c2, c3, c4]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


def test_categorical_filter_logic():
    tg = CodelistPhenotypeCategoricalFilterLogicalCombinationsTestGenerator()
    tg.run_tests()


def test_categorical_filter_logic_autojoin():
    tg = CodelistPhenotypeCategoricalFilterLogicalCombinationsAutojoinTestGenerator()
    tg.run_tests()


def test_fuzzy_match():
    tg = CodelistPhenotypeFuzzyMatchTestGenerator()
    tg.run_tests()


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


def test_categorical_filter_phenotype():
    tg = CodelistPhenotypeCategoricalFilterTestGenerator()
    tg.run_tests()


def test_categorical_filter_is_null_phenotype():
    tg = CodelistPhenotypeCategoricalFilterIsNullTestGenerator()
    tg.run_tests()


def test_return_value():
    tg = CodelistPhenotypeReturnValueTestGenerator()
    tg.run_tests()


def test_return_value_reduced():
    tg = CodelistPhenotypeReturnValueReducedTestGenerator()
    tg.run_tests()


class CodelistPhenotypeReturnValueTestGenerator(PhenotypeTestGenerator):
    """Test the return_value parameter functionality"""

    name_space = "clpt_return_value"
    test_values = True  # Enable value testing
    test_date = True  # Enable date testing
    value_datatype = str  # Set value datatype to str since we're returning codes

    def define_input_tables(self):
        # Create test data with multiple codes on the same date for some patients
        # This will help test the return_value='all' functionality

        # P1 has 2 different codes on the same date (2022-01-01) - should test return_value='all'
        # P2 has codes on different dates - should test first/last selection
        # P3 has 3 different codes on the same date (2022-01-02) - should test return_value='all'

        event_date_1 = datetime.date(2022, 1, 1)
        event_date_2 = datetime.date(2022, 1, 2)
        event_date_3 = datetime.date(2022, 1, 3)

        df = pd.DataFrame.from_dict(
            {
                "CODE": [
                    "c1",
                    "c2",
                    "c1",
                    "c3",
                    "c1",
                    "c2",
                    "c3",
                ],  # Different codes to test return_value
                "PERSON_ID": ["P1", "P1", "P2", "P2", "P3", "P3", "P3"],
                "CODE_TYPE": ["ICD10CM"] * 7,
                "EVENT_DATE": [
                    event_date_1,
                    event_date_1,
                    event_date_1,
                    event_date_3,
                    event_date_2,
                    event_date_2,
                    event_date_2,
                ],
            }
        )

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        event_date_1 = datetime.date(2022, 1, 1)
        event_date_2 = datetime.date(2022, 1, 2)
        event_date_3 = datetime.date(2022, 1, 3)

        # Test 1: return_date='all', return_value='all' - should return all rows with codes as values
        t1 = {
            "name": "all_date_all_value",
            "return_date": "all",
            "return_value": "all",
            "persons": ["P1", "P1", "P2", "P2", "P3", "P3", "P3"],  # All original rows
            "dates": [
                event_date_1,
                event_date_1,
                event_date_1,
                event_date_3,
                event_date_2,
                event_date_2,
                event_date_2,
            ],
            "values": [
                "c1",
                "c2",
                "c1",
                "c3",
                "c1",
                "c2",
                "c3",
            ],  # The matching codes as values
        }

        # Test 2: return_date='first', return_value='all' - should return all codes on first date
        t2 = {
            "name": "first_date_all_value",
            "return_date": "first",
            "return_value": "all",
            "persons": [
                "P2",
                "P3",
                "P3",
                "P3",
                "P1",
                "P1",
            ],  # All rows on first date for each person (order may vary)
            "dates": [
                event_date_1,
                event_date_2,
                event_date_2,
                event_date_2,
                event_date_1,
                event_date_1,
            ],  # First dates
            "values": [
                "c1",
                "c1",
                "c2",
                "c3",
                "c1",
                "c2",
            ],  # Codes on first date for each person
        }

        test_infos = [t1, t2]

        # Create phenotypes for each test
        for test_info in test_infos:
            name = test_info["name"]
            return_date = test_info.get("return_date", "first")
            return_value = test_info.get("return_value", None)

            codelist = Codelist(
                ["c1", "c2", "c3"]
            )  # Include all codes in the test data

            test_info["phenotype"] = CodelistPhenotype(
                name=name,
                domain="CONDITION_OCCURRENCE",
                codelist=codelist,
                return_date=return_date,
                return_value=return_value,
            )

        return test_infos


class CodelistPhenotypeReturnValueReducedTestGenerator(PhenotypeTestGenerator):
    """Test the return_value=None parameter functionality (reduced output)"""

    name_space = "clpt_return_value_reduced"
    test_values = False  # Don't test values since they are null
    test_date = True  # Enable date testing

    def define_input_tables(self):
        # Same input data as the main test
        event_date_1 = datetime.date(2022, 1, 1)
        event_date_2 = datetime.date(2022, 1, 2)
        event_date_3 = datetime.date(2022, 1, 3)

        df = pd.DataFrame.from_dict(
            {
                "CODE": ["c1", "c1", "c1", "c1", "c1", "c1", "c1"],
                "PERSON_ID": ["P1", "P1", "P2", "P2", "P3", "P3", "P3"],
                "CODE_TYPE": ["ICD10CM"] * 7,
                "EVENT_DATE": [
                    event_date_1,
                    event_date_1,
                    event_date_1,
                    event_date_3,
                    event_date_2,
                    event_date_2,
                    event_date_2,
                ],
                "VALUE": [10, 20, 30, 40, 50, 60, 70],
            }
        )

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        event_date_1 = datetime.date(2022, 1, 1)
        event_date_2 = datetime.date(2022, 1, 2)
        event_date_3 = datetime.date(2022, 1, 3)

        # Test: return_date='first', return_value=None (default) - should return first date, one row per person
        t1 = {
            "name": "first_date_default_value",
            "return_date": "first",
            "return_value": None,
            "persons": [
                "P3",
                "P2",
                "P1",
            ],  # One row per person on first date (note: order may vary)
            "dates": [
                event_date_2,
                event_date_1,
                event_date_1,
            ],  # First date for each person
        }

        test_infos = [t1]

        # Create phenotypes for each test
        for test_info in test_infos:
            name = test_info["name"]
            return_date = test_info.get("return_date", "first")
            return_value = test_info.get("return_value", None)

            codelist = Codelist(["c1"])

            test_info["phenotype"] = CodelistPhenotype(
                name=name,
                domain="CONDITION_OCCURRENCE",
                codelist=codelist,
                return_date=return_date,
                return_value=return_value,
            )

        return test_infos


if __name__ == "__main__":
    test_categorical_filter_is_null_phenotype()
    test_categorical_filter_logic()
    test_categorical_filter_logic_autojoin()
    test_categorical_filter_phenotype()
    test_relative_time_range_filter()
    test_anchor_phenotype()
    test_return_date()
    test_fuzzy_match()
    test_return_value()
    test_return_value_reduced()
