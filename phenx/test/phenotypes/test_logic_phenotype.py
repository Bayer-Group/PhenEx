import datetime, os
import pandas as pd

from phenx.phenotypes import CodelistPhenotype, LogicPhenotype

from phenx.codelists import LocalCSVCodelistFactory
from phenx.filters.date_range_filter import DateRangeFilter
from phenx.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenx.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenx.test.phenotype_test_generator import PhenotypeTestGenerator


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
            {"name": "person", "df": df_person},
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
        df["event_date"] = self.event_dates

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "condition_occurrence", "df": df},
            {"name": "person", "df": df_person},
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
        df["event_date"] = self.event_dates

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "condition_occurrence", "df": df},
            {"name": "person", "df": df_person},
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
            # c1orc2,
            # c1andc3,
            # c1andc2orc1andc3,
            # c1andc2andc1andc3,
            # c1andc2orc3,
            # c1andc2andc3,
        ]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class LogicPhenotypeInverseReturnDateLastTestGenerator(
    LogicPhenotypeReturnDateLastTestGenerator
):
    name_space = "lgpt_inverse_returndate_last"

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
            "phenotype": LogicPhenotype(
                expression=~(c1["phenotype"] & c2["phenotype"])
                | ~(c1["phenotype"] & c3["phenotype"]),
            ),
        }

        notc1andc2orc1andc3 = {
            "name": "notc1andc2orc1andc3",
            "persons": ["P4", "P5", "P6", "P7"],
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
            c1orc2,
            c1andc3,
            c1andc2orc1andc3,
            notc1andc2orc1andc3,
            not_c1,
            not_c1_and_not_c2,
        ]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]
            test_info["column_types"] = {
                f"{test_info['phenotype'].name_model}_date": "date"
            }

        return test_infos


class LogicPhenotypeReturnDateFirstTestGenerator(PhenotypeTestGenerator):
    name_space = "lgpt_returndate_first"

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
                "01-01-2022",  # P4 c1 7
                "01-02-2022",  # P5 c2 8
                "01-03-2022",  # P5 c3 9
                "01-01-2022",  # P6 c2 10
                "01-01-2022",  # P7 c3 11
            ]
        ]
        df["event_date"] = self.event_dates

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "condition_occurrence", "df": df},
            {"name": "person", "df": df_person},
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


def test_logic_phenotype():
    import ibis
    spg = LogicPhenotypeTestGenerator()
    # spg.con = ibis.duckdb.connect()

    # spg.run_tests()

    # spg = LogicPhenotypeReturnDateLastTestGenerator()
    # spg.generate()

    # spg = LogicPhenotypeInverseReturnDateLastTestGenerator()
    # spg.generate()

    # spg = LogicPhenotypeReturnDateAllTestGenerator()
    # spg.generate()

    # spg = LogicPhenotypeReturnDateFirstTestGenerator()
    # spg.generate()


if __name__ == "__main__":
    test_logic_phenotype()
