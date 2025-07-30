import datetime, os
import pandas as pd

import ibis

from phenex.phenotypes.user_defined_phenotype import UserDefinedPhenotype
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class UserDefinedPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "udpt"
    test_date = True

    def define_input_tables(self):
        index_date = datetime.datetime.strptime("01-01-2022", "%m-%d-%Y")

        self.n_persons = 9

        user_defined_dates = (
            [None]
            + [index_date - datetime.timedelta(days=20 * i) for i in range(4)]
            + [index_date + datetime.timedelta(days=20 * i) for i in range(4)]
        )

        N = len(user_defined_dates)

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = [f"P{x}" for x in list(range(N))]
        df_person["DATE_OF_user_defined"] = user_defined_dates
        df_person["INDEX_DATE"] = index_date

        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }

        self.input_table = df_person
        return [input_info_person]

    def define_phenotype_tests(self):

        def function1(mapped_tables):
            df = pd.DataFrame()
            df["PERSON_ID"] = ["P1", "P2", "P3", "P4", "P5"]
            return ibis.memtable(df)

        idx_persons = [1, 2, 3, 4, 5]
        t1 = {
            "name": "all_true_patients",
            "persons": [f"P{x}" for x in idx_persons],
            "phenotype": UserDefinedPhenotype(
                function=function1,
            ),
        }

        def function2(mapped_tables):
            df = pd.DataFrame()
            df["PERSON_ID"] = ["P1", "P2", "P3", "P4", "P5"]
            df["BOOLEAN"] = [True, True, True, False, False]
            return ibis.memtable(df)

        idx_persons = [1, 2, 3]
        t2 = {
            "name": "some_true_some_false",
            "persons": [f"P{x}" for x in idx_persons],
            "phenotype": UserDefinedPhenotype(
                function=function2,
            ),
        }

        test_infos = [t1, t2]  # , t2, t3, t4, t5, t6, t7, t8, t9]

        for test_info in test_infos:
            test_info["phenotype"].name = test_info["name"]

        return test_infos


def test_user_defined_phenotype():
    spg = UserDefinedPhenotypeTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_user_defined_phenotype()
