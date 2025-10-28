import datetime, os
import pandas as pd

from phenex.phenotypes import CodelistPhenotype, LogicPhenotype, MeasurementPhenotype

from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_filter import DateFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class LogicPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "lgpt"

    def define_input_tables(self):
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "condition_occurrence", "df": df},
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c1 = {
            "name": "c1",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
            ),
        }

        c2 = {
            "name": "c2",
            "persons": ["P1", "P2", "P5", "P6"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c2"),
                domain="condition_occurrence",
            ),
        }

        c3 = {
            "name": "c3",
            "persons": ["P1", "P3", "P5", "P7"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c3"),
                domain="condition_occurrence",
            ),
        }

        c1andc2 = {
            "name": "c1_and_c2",
            "persons": ["P1", "P2"],
            "phenotype": LogicPhenotype(expression=(c1["phenotype"] & c2["phenotype"])),
        }

        c1orc2 = {
            "name": "c1_or_c2",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6"],
            "phenotype": LogicPhenotype(expression=(c1["phenotype"] | c2["phenotype"])),
        }

        c1andc3 = {
            "name": "c1_and_c3",
            "persons": ["P1", "P3"],
            "phenotype": LogicPhenotype(expression=(c1["phenotype"] & c3["phenotype"])),
        }

        c1andc2orc1andc3 = {
            "name": "c1andc2orc1andc3",
            "persons": ["P1", "P2", "P3"],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"])
                | (c1["phenotype"] & c3["phenotype"])
            ),
        }

        c1andc2andc1andc3 = {
            "name": "c1andc2andc1andc3",
            "persons": ["P1"],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"])
                & (c1["phenotype"] & c3["phenotype"])
            ),
        }

        c1andc2orc3 = {
            "name": "c1andc2orc3",
            "persons": ["P1", "P2", "P3", "P5", "P7"],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]) | c3["phenotype"]
            ),
        }

        c1andc2andc3 = {
            "name": "c1andc2andc3",
            "persons": ["P1"],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]) & c3["phenotype"]
            ),
        }

        test_infos = [
            c1andc2,
            c1orc2,
            c1andc3,
            c1andc2orc1andc3,
            c1andc2andc1andc3,
            c1andc2orc3,
            c1andc2andc3,
        ]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class LogicPhenotypeReturnDateLastTestGenerator(PhenotypeTestGenerator):
    name_space = "lgpt_returndate_last"
    test_date = True

    def define_input_tables(self):
        """
        P1,c1,01-01-2022  0
        P1,c2,01-02-2022  1
        P1,c3,01-03-2022  2

        P2,c1,01-01-2022  3
        P2,c2,01-02-2022  4

        P3,c1,01-01-2022  5
        P3,c3,01-03-2022  6

        P4,c1,01-01-2022  7

        P5,c2,01-02-2022  8
        P5,c3,01-03-2022  9

        P6,c2,01-01-2022  10

        P7,c3,01-01-2022  11
        """
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )

        self.event_dates = [
            datetime.datetime.strptime(x, "%m-%d-%Y")
            for x in [
                "01-01-2022",  # P1 c1 0
                "01-02-2022",  # P1 c2 1
                "01-03-2022",  # P1 c3 2
                "01-01-2022",  # P2 c1 3
                "01-02-2022",  # P2 c2 4
                "01-01-2022",  # P3 c1 5
                "01-03-2022",  # P3 c3 6
                "01-01-2022",  # P4 c1 7    P
                "01-02-2022",  # P5 c2 8
                "01-03-2022",  # P5 c3 9
                "01-01-2022",  # P6 c2 10
                "01-01-2022",  # P7 c3 11
            ]
        ]
        df["EVENT_DATE"] = self.event_dates

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "condition_occurrence", "df": df},
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        c1 = {
            "name": "c1",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c2 = {
            "name": "c2",
            "persons": ["P1", "P2", "P5", "P6"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c2"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c3 = {
            "name": "c3",
            "persons": ["P1", "P3", "P5", "P7"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c3"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c1andc2 = {
            "name": "c1_and_c2",
            "persons": ["P1", "P2"],
            "dates": [self.event_dates[1], self.event_dates[4]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]), return_date="last"
            ),
        }

        c1orc2 = {
            "name": "c1_or_c2",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6"],
            "dates": [
                self.event_dates[1],
                self.event_dates[4],
                self.event_dates[5],
                self.event_dates[7],
                self.event_dates[8],
                self.event_dates[10],
            ],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] | c2["phenotype"]), return_date="last"
            ),
        }

        c1andc3 = {
            "name": "c1_and_c3",
            "persons": ["P1", "P3"],
            "dates": [self.event_dates[2], self.event_dates[6]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c3["phenotype"]), return_date="last"
            ),
        }

        c1andc2orc1andc3 = {
            "name": "c1andc2orc1andc3",
            "persons": ["P1", "P2", "P3"],
            "dates": [self.event_dates[2], self.event_dates[4], self.event_dates[6]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"])
                | (c1["phenotype"] & c3["phenotype"]),
                return_date="last",
            ),
        }

        c1andc2andc1andc3 = {
            "name": "c1andc2andc1andc3",
            "persons": ["P1"],
            "dates": [self.event_dates[2]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"])
                & (c1["phenotype"] & c3["phenotype"]),
                return_date="last",
            ),
        }

        c1andc2orc3 = {
            "name": "c1andc2orc3",
            "persons": ["P1", "P2", "P3", "P5", "P7"],
            "dates": [
                self.event_dates[2],
                self.event_dates[4],
                self.event_dates[6],
                self.event_dates[9],
                self.event_dates[11],
            ],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]) | c3["phenotype"],
                return_date="last",
            ),
        }

        c1andc2andc3 = {
            "name": "c1andc2andc3",
            "persons": ["P1"],
            "dates": [self.event_dates[2]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]) & c3["phenotype"],
                return_date="last",
            ),
        }

        test_infos = [
            c1andc2,
            c1orc2,
            c1andc3,
            c1andc2orc1andc3,
            c1andc2andc1andc3,
            c1andc2orc3,
            c1andc2andc3,
        ]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class LogicPhenotypeReturnDateAllTestGenerator(PhenotypeTestGenerator):
    name_space = "lgpt_returndate_all"
    test_date = True
    join_on = ["PERSON_ID", "EVENT_DATE"]

    def define_input_tables(self):
        """
        P1,c1,01-01-2022  0
        P1,c2,01-02-2022  1
        P1,c3,01-03-2022  2

        P2,c1,01-01-2022  3
        P2,c2,01-02-2022  4

        P3,c1,01-01-2022  5
        P3,c3,01-03-2022  6

        P4,c1,01-01-2022  7

        P5,c2,01-02-2022  8
        P5,c3,01-03-2022  9

        P6,c2,01-01-2022  10

        P7,c3,01-01-2022  11
        """
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )

        self.event_dates = [
            datetime.datetime.strptime(x, "%m-%d-%Y")
            for x in [
                "01-01-2022",  # P1 c1 0
                "01-02-2022",  # P1 c2 1
                "01-03-2022",  # P1 c3 2
                "01-01-2022",  # P2 c1 3
                "01-02-2022",  # P2 c2 4
                "01-01-2022",  # P3 c1 5
                "01-03-2022",  # P3 c3 6
                "01-01-2022",  # P4 c1 7    P
                "01-02-2022",  # P5 c2 8
                "01-03-2022",  # P5 c3 9
                "01-01-2022",  # P6 c2 10
                "01-01-2022",  # P7 c3 11
            ]
        ]
        df["EVENT_DATE"] = self.event_dates

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "condition_occurrence", "df": df},
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        c1 = {
            "name": "c1",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c2 = {
            "name": "c2",
            "persons": ["P1", "P2", "P5", "P6"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c2"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c3 = {
            "name": "c3",
            "persons": ["P1", "P3", "P5", "P7"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c3"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c1andc2 = {
            "name": "c1_and_c2",
            "persons": ["P1", "P1", "P2", "P2"],
            "dates": [
                self.event_dates[0],
                self.event_dates[1],
                self.event_dates[3],
                self.event_dates[4],
            ],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]), return_date="all"
            ),
        }

        c1orc2 = {
            "name": "c1_or_c2",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6"],
            "dates": [
                self.event_dates[1],
                self.event_dates[4],
                self.event_dates[5],
                self.event_dates[7],
                self.event_dates[8],
                self.event_dates[10],
            ],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] | c2["phenotype"]), return_date="last"
            ),
        }

        c1andc3 = {
            "name": "c1_and_c3",
            "persons": ["P1", "P3"],
            "dates": [self.event_dates[2], self.event_dates[6]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c3["phenotype"]), return_date="last"
            ),
        }

        c1andc2orc1andc3 = {
            "name": "c1andc2orc1andc3",
            "persons": ["P1", "P2", "P3"],
            "dates": [self.event_dates[2], self.event_dates[4], self.event_dates[6]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"])
                | (c1["phenotype"] & c3["phenotype"]),
                return_date="last",
            ),
        }

        c1andc2andc1andc3 = {
            "name": "c1andc2andc1andc3",
            "persons": ["P1"],
            "dates": [self.event_dates[2]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"])
                & (c1["phenotype"] & c3["phenotype"]),
                return_date="last",
            ),
        }

        c1andc2orc3 = {
            "name": "c1andc2orc3",
            "persons": ["P1", "P2", "P3", "P5", "P7"],
            "dates": [
                self.event_dates[2],
                self.event_dates[4],
                self.event_dates[6],
                self.event_dates[9],
                self.event_dates[11],
            ],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]) | c3["phenotype"],
                return_date="last",
            ),
        }

        c1andc2andc3 = {
            "name": "c1andc2andc3",
            "persons": ["P1"],
            "dates": [self.event_dates[2]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]) & c3["phenotype"],
                return_date="last",
            ),
        }

        test_infos = [
            c1andc2,
            c1orc2,
            c1andc3,
            c1andc2orc1andc3,
            c1andc2andc1andc3,
            c1andc2orc3,
            c1andc2andc3,
        ]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class LogicPhenotypeInverseReturnDateLastTestGenerator(
    LogicPhenotypeReturnDateLastTestGenerator
):
    name_space = "lgpt_inverse_returndate_last"
    test_date = True

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        c1 = {
            "name": "c1",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c2 = {
            "name": "c2",
            "persons": ["P1", "P2", "P5", "P6"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c2"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c3 = {
            "name": "c3",
            "persons": ["P1", "P3", "P5", "P7"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c3"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c1andc2 = {
            "name": "not_c1_and_c2",
            "persons": ["P3", "P4", "P5", "P6", "P7"],
            "dates": [
                self.event_dates[5],
                self.event_dates[7],
                self.event_dates[8],
                self.event_dates[10],
                None,
            ],
            "phenotype": LogicPhenotype(
                expression=(~(c1["phenotype"] & c2["phenotype"])), return_date="last"
            ),
        }

        c1orc2 = {
            "name": "not_c1_or_c2",
            "persons": ["P7"],
            "dates": [None],
            "phenotype": LogicPhenotype(
                expression=~(c1["phenotype"] | c2["phenotype"]), return_date="last"
            ),
        }

        c1andc3 = {
            "name": "not_c1_and_c3",
            "persons": ["P2", "P4", "P5", "P6", "P7"],
            "dates": [
                self.event_dates[3],
                self.event_dates[7],
                self.event_dates[9],
                None,
                self.event_dates[11],
            ],
            "phenotype": LogicPhenotype(
                expression=~(c1["phenotype"] & c3["phenotype"]), return_date="last"
            ),
        }

        c1andc2orc1andc3 = {
            "name": "notc1andc2ornotc1andc3",
            "persons": ["P2", "P3", "P4", "P5", "P6", "P7"],
            "dates": [
                self.event_dates[3],
                self.event_dates[5],
                self.event_dates[7],
                self.event_dates[8],
                self.event_dates[10],
                self.event_dates[11],
            ],
            "phenotype": LogicPhenotype(
                expression=~(c1["phenotype"] & c2["phenotype"])
                | ~(c1["phenotype"] & c3["phenotype"]),
            ),
        }

        notc1andc2orc1andc3 = {
            "name": "notc1andc2orc1andc3",
            "persons": ["P4", "P5", "P6", "P7"],
            "dates": [
                self.event_dates[7],
                self.event_dates[8],
                self.event_dates[10],
                self.event_dates[11],
            ],
            "phenotype": LogicPhenotype(
                expression=~(
                    (c1["phenotype"] & c2["phenotype"])
                    | (c1["phenotype"] & c3["phenotype"])
                ),
            ),
        }

        # "01-01-2022",  # P1 c1 0
        # "01-02-2022",  # P1 c2 1
        # "01-03-2022",  # P1 c3 2
        #
        # "01-01-2022",  # P2 c1 3
        # "01-02-2022",  # P2 c2 4
        #
        # "01-01-2022",  # P3 c1 5
        # "01-03-2022",  # P3 c3 6
        #
        # "01-01-2022",  # P4 c1 7    P
        #
        # "01-02-2022",  # P5 c2 8
        # "01-03-2022",  # P5 c3 9
        #
        # "01-01-2022",  # P6 c2 10
        #
        # "01-01-2022",  # P7 c3 11

        not_c1 = {
            "name": "not_c1",
            "persons": ["P5", "P6", "P7"],
            "dates": [None, None, None],
            "phenotype": LogicPhenotype(
                expression=~c1["phenotype"], return_date="last"
            ),
        }

        not_c1_and_not_c2 = {
            "name": "not_c1_and_not_c2",
            "persons": ["P7"],
            "dates": [None],
            "phenotype": LogicPhenotype(
                expression=~c1["phenotype"] & ~c2["phenotype"], return_date="last"
            ),
        }

        test_infos = [
            c1andc2,
            not_c1,
            c1orc2,
            c1andc3,
            c1andc2orc1andc3,
            notc1andc2orc1andc3,
            not_c1_and_not_c2,
        ]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class LogicPhenotypeReturnDateFirstTestGenerator(PhenotypeTestGenerator):
    name_space = "lgpt_returndate_first"
    test_date = True

    def define_input_tables(self):
        """
        P1,c1,01-01-2022  0
        P1,c2,01-02-2022  1
        P1,c3,01-03-2022  2

        P2,c1,01-01-2022  3
        P2,c2,01-02-2022  4

        P3,c1,01-01-2022  5
        P3,c3,01-03-2022  6

        P4,c1,01-01-2022  7

        P5,c2,01-02-2022  8
        P5,c3,01-03-2022  9

        P6,c2,01-01-2022  10

        P7,c3,01-01-2022  11
        """
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )
        df_firstrow_same_event_date = df.iloc[0:1].copy()
        df_firstrow_different_event_date = df.iloc[0:1].copy()

        df = pd.concat(
            [df, df_firstrow_same_event_date, df_firstrow_different_event_date],
            ignore_index=True,
        )  # duplicate row 1 P1 to test that first last date selection is working
        self.event_dates = [
            datetime.datetime.strptime(x, "%m-%d-%Y")
            for x in [
                "01-01-2022",  # P1 c1 0
                "01-02-2022",  # P1 c2 1
                "01-03-2022",  # P1 c3 2
                "01-01-2022",  # P2 c1 3
                "01-02-2022",  # P2 c2 4
                "01-01-2022",  # P3 c1 5
                "01-03-2022",  # P3 c3 6
                "01-01-2022",  # P4 c1 7
                "01-02-2022",  # P5 c2 8
                "01-03-2022",  # P5 c3 9
                "01-01-2022",  # P6 c2 10
                "01-01-2022",  # P7 c3 11
                "01-01-2022",  # P1 c1 0 # duplicate row 1 P1 with same event date
                "01-12-2022",  # P1 c1 0 # duplicate row 1 P1 with different event date
            ]
        ]
        df["EVENT_DATE"] = self.event_dates

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "condition_occurrence", "df": df},
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        c1 = {
            "name": "c1",
            "persons": ["P1", "P2", "P3", "P4"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c1"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c2 = {
            "name": "c2",
            "persons": ["P1", "P2", "P5", "P6"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c2"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c3 = {
            "name": "c3",
            "persons": ["P1", "P3", "P5", "P7"],
            "phenotype": CodelistPhenotype(
                codelist=codelist_factory.get_codelist("c3"),
                domain="condition_occurrence",
                return_date="all",
            ),
        }

        c1andc2 = {
            "name": "c1_and_c2",
            "persons": ["P1", "P2"],
            "dates": [self.event_dates[0], self.event_dates[3]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]), return_date="first"
            ),
        }

        c1orc2 = {
            "name": "c1_or_c2",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6"],
            "dates": [
                self.event_dates[0],
                self.event_dates[3],
                self.event_dates[5],
                self.event_dates[7],
                self.event_dates[8],
                self.event_dates[10],
            ],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] | c2["phenotype"]), return_date="first"
            ),
        }

        c1andc3 = {
            "name": "c1_and_c3",
            "persons": ["P1", "P3"],
            "dates": [self.event_dates[0], self.event_dates[5]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c3["phenotype"]), return_date="first"
            ),
        }

        c1andc2orc1andc3 = {
            "name": "c1andc2orc1andc3",
            "persons": ["P1", "P2", "P3"],
            "dates": [self.event_dates[0], self.event_dates[3], self.event_dates[5]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"])
                | (c1["phenotype"] & c3["phenotype"]),
                return_date="first",
            ),
        }

        c1andc2andc1andc3 = {
            "name": "c1andc2andc1andc3",
            "persons": ["P1"],
            "dates": [self.event_dates[0]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"])
                & (c1["phenotype"] & c3["phenotype"]),
                return_date="first",
            ),
        }

        c1andc2orc3 = {
            "name": "c1andc2orc3",
            "persons": ["P1", "P2", "P3", "P5", "P7"],
            "dates": [
                self.event_dates[0],
                self.event_dates[3],
                self.event_dates[5],
                self.event_dates[8],
                self.event_dates[11],
            ],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]) | c3["phenotype"],
                return_date="first",
            ),
        }

        c1andc2andc3 = {
            "name": "c1andc2andc3",
            "persons": ["P1"],
            "dates": [self.event_dates[0]],
            "phenotype": LogicPhenotype(
                expression=(c1["phenotype"] & c2["phenotype"]) & c3["phenotype"],
                return_date="first",
            ),
        }

        test_infos = [
            c1andc2,
            c1orc2,
            c1andc3,
            c1andc2orc1andc3,
            c1andc2andc1andc3,
            c1andc2orc3,
            c1andc2andc3,
        ]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class LogicPhenotypeValueTestGenerator(PhenotypeTestGenerator):
    """
    Test generator for LogicPhenotype VALUE column population functionality.
    Uses MeasurementPhenotype to test that LogicPhenotype correctly populates
    the VALUE column with the value from the phenotype whose date is selected.
    """

    name_space = "lgpt_value_test"
    test_values = True  # Enable VALUE column testing
    value_datatype = float

    def define_input_tables(self):
        """
        Create measurement data with known values for testing VALUE population.
        Each patient has at most one measurement per code to avoid duplicates.
        """
        df = pd.DataFrame(
            {
                "PERSON_ID": ["P1", "P1", "P2", "P2", "P3"],
                "CODE": ["M1", "M2", "M1", "M2", "M1"],
                "CODE_TYPE": [
                    "measurement",
                    "measurement",
                    "measurement",
                    "measurement",
                    "measurement",
                ],
                "EVENT_DATE": [
                    datetime.date(2022, 1, 1),  # P1 has M1 on Jan 1 (VALUE=10)
                    datetime.date(2022, 2, 1),  # P1 has M2 on Feb 1 (VALUE=20)
                    datetime.date(2022, 1, 15),  # P2 has M1 on Jan 15 (VALUE=15)
                    datetime.date(2022, 1, 10),  # P2 has M2 on Jan 10 (VALUE=25)
                    datetime.date(
                        2022, 3, 1
                    ),  # P3 has M1 on Mar 1 (VALUE=31) - only M1, no M2
                ],
                "VALUE": [10.0, 20.0, 15.0, 25.0, 31.0],
            }
        )

        df_person = pd.DataFrame({"PERSON_ID": ["P1", "P2", "P3"]})

        return [
            {"name": "measurement", "df": df},
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        """
        Define test cases for LogicPhenotype VALUE population.
        """
        # Create a test codelist CSV
        test_codelist_path = os.path.join(
            os.path.dirname(__file__),
            "artifacts",
            self.name_space,
            "test_codelists.csv",
        )
        os.makedirs(os.path.dirname(test_codelist_path), exist_ok=True)

        codelist_df = pd.DataFrame(
            {
                "code": ["M1", "M2"],
                "codelist": ["m1", "m2"],
                "code_type": ["measurement", "measurement"],
                "description": ["Measurement 1", "Measurement 2"],
            }
        )
        codelist_df.to_csv(test_codelist_path, index=False)

        codelist_factory = LocalCSVCodelistFactory(test_codelist_path)

        m1 = {
            "name": "m1",
            "persons": ["P1", "P2", "P3"],
            "phenotype": MeasurementPhenotype(
                codelist=codelist_factory.get_codelist("m1"),
                domain="measurement",
                name="m1",
                return_date="first",  # Ensure single row per person
            ),
        }

        m2 = {
            "name": "m2",
            "persons": ["P1", "P2"],
            "phenotype": MeasurementPhenotype(
                codelist=codelist_factory.get_codelist("m2"),
                domain="measurement",
                name="m2",
                return_date="first",  # Ensure single row per person
            ),
        }

        # Test LogicPhenotype with return_date="first" - should return VALUE from earliest date
        m1_and_m2_first = {
            "name": "m1_and_m2_first",
            "persons": ["P1", "P2"],  # Only P1 and P2 have both measurements
            "values": [
                10.0,
                25.0,
            ],  # P1: earliest is Jan 1 (M1=10), P2: earliest is Jan 10 (M2=25)
            "dates": [datetime.date(2022, 1, 1), datetime.date(2022, 1, 10)],
            "phenotype": LogicPhenotype(
                expression=(m1["phenotype"] & m2["phenotype"]),
                return_date="first",
                name="m1_and_m2_first",
            ),
        }

        # Test LogicPhenotype with return_date="last" - should return VALUE from latest date
        m1_and_m2_last = {
            "name": "m1_and_m2_last",
            "persons": ["P1", "P2"],  # Only P1 and P2 have both measurements
            "values": [
                20.0,
                15.0,
            ],  # P1: latest is Feb 1 (M2=20), P2: latest is Jan 15 (M1=15)
            "dates": [datetime.date(2022, 2, 1), datetime.date(2022, 1, 15)],
            "phenotype": LogicPhenotype(
                expression=(m1["phenotype"] & m2["phenotype"]),
                return_date="last",
                name="m1_and_m2_last",
            ),
        }

        test_infos = [m1_and_m2_first, m1_and_m2_last]
        return test_infos


def test_logic_phenotype_1():
    spg = LogicPhenotypeTestGenerator()
    spg.run_tests()


def test_logic_phenotype_2():
    spg = LogicPhenotypeReturnDateLastTestGenerator()
    spg.run_tests()


def test_logic_phenotype_3():
    spg = LogicPhenotypeReturnDateAllTestGenerator()
    spg.run_tests()


def test_logic_phenotype_4():
    spg = LogicPhenotypeReturnDateFirstTestGenerator()
    spg.run_tests()


def test_logic_phenotype_5():
    spg = LogicPhenotypeInverseReturnDateLastTestGenerator()
    spg.run_tests()


def test_logic_phenotype_value():
    """Test LogicPhenotype VALUE column population functionality."""
    spg = LogicPhenotypeValueTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_logic_phenotype_1()
    test_logic_phenotype_2()
    test_logic_phenotype_3()
    test_logic_phenotype_4()
    test_logic_phenotype_5()
    test_logic_phenotype_value()
