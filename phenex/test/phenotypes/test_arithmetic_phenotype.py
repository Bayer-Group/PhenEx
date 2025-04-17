import datetime, os
import pandas as pd

from phenex.phenotypes import (
    CodelistPhenotype,
    MeasurementPhenotype,
    ArithmeticPhenotype,
)

from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_filter import DateFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.aggregators import *
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class ArithmeticPhenotypeArithmeticPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "arpt_value"

    def define_input_tables(self):
        """
                                        c1      c2      c3          c1+c2       c1*c2   c1-c2   c1/c2                                c2/(c3/100)**2
        P1,c1,ICD10CM,01-01-2022,0      0                           0+1 = 1     0       -1      0       1/(2/100)**2
        P1,c2,ICD10CM,01-01-2022,1              1                         2     0       -2      0
        P1,c3,ICD10CM,01-01-2022,2                      2

        P2,c1,ICD10CM,01-01-2022,3      3                           3+4 = 7     12      -1      3/4
        P2,c2,ICD10CM,01-01-2022,4              4                         11    24      -5      3/8

        P3,c1,ICD10CM,01-01-2022,5      5
        P3,c3,ICD10CM,01-01-2022,6                      6

        P4,c1,ICD10CM,01-01-2022,7      7

        P5,c2,ICD10CM,01-01-2022,8              8                                                       8/(9/100)**2
        P5,c3,ICD10CM,01-01-2022,9                      9

        P6,c2,ICD10CM,01-01-2022,10             10

        P7,c3,ICD10CM,01-01-2022,11                     11

        """
        df, tt = sdf_and_tt_dummycodes_3variables(
            code_columnname="CODE",
            patientid_columnname="PERSON_ID",
            code_type_columnname="CODE_TYPE",
            event_date_columnname="EVENT_DATE",
        )
        df["VALUE"] = range(df.shape[0])

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "measurement", "df": df},
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        c1 = MeasurementPhenotype(
            codelist=codelist_factory.get_codelist("c1"),
            domain="measurement",
            return_value=Mean(),
        )

        c2 = MeasurementPhenotype(
            codelist=codelist_factory.get_codelist("c2"),
            domain="measurement",
            return_value=Mean(),
        )

        c3 = MeasurementPhenotype(
            codelist=codelist_factory.get_codelist("c3"),
            domain="measurement",
            return_value=Mean(),
        )

        arithmetic1 = {
            "name": "arithmetic1",
            "persons": ["P1", "P2"],
            "values": [1, 7],
            "phenotype": ArithmeticPhenotype(expression=(c1 + c2)),
        }

        arithmetic2 = {
            "name": "arithmetic2",
            "persons": ["P1", "P2"],
            "values": [0, 12],
            "phenotype": ArithmeticPhenotype(expression=(c1 * c2)),
        }

        arithmetic3 = {
            "name": "arithmetic3",
            "persons": ["P1", "P2"],
            "values": [-1, -1],
            "phenotype": ArithmeticPhenotype(expression=(c1 - c2)),
        }

        arithmetic4 = {
            "name": "arithmetic4",
            "persons": ["P1", "P2"],
            "values": [0, 3 / 4],
            "phenotype": ArithmeticPhenotype(expression=(c1 / c2)),
        }

        arithmetic1_1 = {
            "name": "arithmetic1_1",
            "persons": ["P1", "P2"],
            "values": [2, 11],
            "phenotype": ArithmeticPhenotype(expression=(c1 + c2 * 2)),
        }

        arithmetic2_1 = {
            "name": "arithmetic2_1",
            "persons": ["P1", "P2"],
            "values": [0, 24],
            "phenotype": ArithmeticPhenotype(expression=(c1 * (c2 * 2))),
        }

        arithmetic3_1 = {
            "name": "arithmetic3_1",
            "persons": ["P1", "P2"],
            "values": [-2, -5],
            "phenotype": ArithmeticPhenotype(expression=(c1 - c2 * 2)),
        }

        arithmetic4_1 = {
            "name": "arithmetic4_1",
            "persons": ["P1", "P2"],
            "values": [0, 3 / 8],
            "phenotype": ArithmeticPhenotype(expression=(c1 / (c2 * 2))),
        }

        # arithmetic5 = {
        #     "name": "arithmetic5",
        #     "persons": ["P1", "P2"],
        #     "values": [0, 3 / 16],
        #     "phenotype": ArithmeticPhenotype(expression=(c1 / (c2**2))),
        # }

        # arithmetic6 = {
        #     "name": "arithmetic6_bmi",
        #     "persons": ["P1", "P5"],
        #     "values": [1 / (2 / 100) ** 2, 8 / (9 / 100) ** 2],
        #     "phenotype": ArithmeticPhenotype(expression=c2 / (c3 / 100) ** 2),
        # }

        test_infos = [
            arithmetic1,
            arithmetic2,
            arithmetic3,
            arithmetic4,
            arithmetic1_1,
            arithmetic2_1,
            arithmetic3_1,
            arithmetic4_1,
            # arithmetic5,
            # arithmetic6,
        ]
        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


class ArithmeticPhenotypeCountPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "arpt_countphenotype"

    def define_input_tables(self):
        df = pd.DataFrame()
        # P1 has c1 10 times        c2 50 times
        # P2 has c1 20 times        c2 5 times
        n_p1_c1, n_p1_c2 = 10, 50
        n_p2_c1, n_p2_c2 = 20, 5

        df["PERSON_ID"] = ["P1"] * (n_p1_c1 + n_p1_c2) + ["P2"] * (n_p2_c1 + n_p2_c2)
        df["CODE"] = (
            ["c1"] * n_p1_c1 + ["c2"] * n_p1_c2 + ["c1"] * n_p2_c1 + ["c2"] * n_p2_c2
        )
        df["CODE_TYPE"] = ["ICD10CM"] * df.shape[0]

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "condition_occurrence", "df": df},
            {"name": "PERSON", "df": df_person},
        ]

    def define_phenotype_tests(self):
        c1 = CountPhenotype(
            CodelistPhenotype(
                codelist="c1",
                table=CodeTable(name=self.name_file("input"), stage="ref"),
            )
        )

        c2 = CountPhenotype(
            CodelistPhenotype(
                codelist="c2",
                table=CodeTable(name=self.name_file("input"), stage="ref"),
            )
        )

        arithmetic1 = {
            "name": "arithmetic1",
            "persons": ["P1", "P2"],
            "values": [1 / 5, 20 / 5],
            "phenotype": ArithmeticPhenotype(expression=(c1 / c2)),
        }

        arithmetic2 = {
            "name": "arithmetic2",
            "persons": ["P1"],
            "values": [1 / 5],
            "phenotype": ArithmeticPhenotype(
                expression=(c1 / c2), value_filter=ValueFilter("<", 1)
            ),
        }

        test_infos = [
            arithmetic1,
            arithmetic2,
        ]  # , arithmetic2, arithmetic3, arithmetic4, arithmetic5]
        for test_info in test_infos:
            test_info["phenotype"].name_space = self.name_space
            test_info["phenotype"].name_phenotype = test_info["name"]

        return test_infos


def test_arithmetic():
    spg = ArithmeticPhenotypeArithmeticPhenotypeTestGenerator()
    spg.run_tests()


# def test_count_phenotype_arithmetic():
#     spg = ArithmeticPhenotypeCountPhenotypeTestGenerator()
#     spg.run_tests()


if __name__ == "__main__":
    test_arithmetic()
    # test_count_phenotype_arithmetic()
