import datetime, os
import pandas as pd

from phenex.phenotypes.age_phenotype import AgePhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.filters.date_filter import DateFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters import Value, ValueFilter

from phenex.mappers import *


class AgePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "agpt"

    def define_input_tables(self):
        index_date = datetime.date(2022, 1, 1)

        self.n_persons = 100

        birth_dates = [
            index_date - datetime.timedelta(days=365.25 * i)
            for i in range(self.n_persons)
        ]
        N = len(birth_dates)

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = [f"P{x}" for x in list(range(N))]
        df_person["DATE_OF_BIRTH"] = birth_dates
        df_person["INDEX_DATE"] = index_date

        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }

        return [input_info_person]

    def define_phenotype_tests(self):
        ages_matching = list(range(18, self.n_persons))
        ge_18 = {
            "name": "age_ge18",
            "value_filter": ValueFilter(min_value=Value(value=18, operator=">=")),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(19, self.n_persons))
        g_18 = {
            "name": "age_g18",
            "value_filter": ValueFilter(min_value=Value(value=18, operator=">")),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(18, 46))
        ge_18_le_45 = {
            "name": "age_ge_18_le_45",
            "value_filter": ValueFilter(
                min_value=Value(value=18, operator=">="),
                max_value=Value(value=45, operator="<="),
            ),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(19, 46))
        g_18_le_45 = {
            "name": "age_g_18_le_45",
            "value_filter": ValueFilter(
                min_value=Value(value=18, operator=">"),
                max_value=Value(value=45, operator="<="),
            ),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(18, 45))
        ge_18_l_45 = {
            "name": "age_ge_18_l_45",
            "value_filter": ValueFilter(
                min_value=Value(value=18, operator=">="),
                max_value=Value(value=45, operator="<"),
            ),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(19, 45))
        g_18_l_45 = {
            "name": "age_g_18_l_45",
            "value_filter": ValueFilter(
                min_value=Value(value=18, operator=">"),
                max_value=Value(value=45, operator="<"),
            ),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(0, 19))
        le_18 = {
            "name": "age_le_18",
            "value_filter": ValueFilter(max_value=Value(value=18, operator="<=")),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(0, 18))
        l_18 = {
            "name": "age_l_18",
            "value_filter": ValueFilter(max_value=Value(value=18, operator="<")),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(45, self.n_persons))
        ge_45 = {
            "name": "age_ge_45",
            "value_filter": ValueFilter(min_value=Value(value=45, operator=">=")),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(46, self.n_persons))
        g_45 = {
            "name": "age_g_45",
            "value_filter": ValueFilter(min_value=Value(value=45, operator=">")),
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        ages_matching = list(range(0, self.n_persons))
        allages = {
            "name": "age_all",
            "persons": [f"P{x}" for x in ages_matching],
            "values": ages_matching,
        }

        test_infos = [
            ge_18,
            g_18,
            ge_18_le_45,
            g_18_le_45,
            ge_18_l_45,
            g_18_l_45,
            le_18,
            l_18,
            ge_45,
            g_45,
            allages,
        ]
        for test_info in test_infos:
            test_info["phenotype"] = AgePhenotype(
                name=test_info["name"],
                value_filter=test_info.get("value_filter"),
            )

        return test_infos


class AgePhenotypeImputeMonthDayTestGenerator(PhenotypeTestGenerator):
    name_space = "agpt_impute_month_day"

    def define_input_tables(self):
        index_date = datetime.date(2018, 7, 7)

        self.n_persons = 7

        birth_years = self.n_persons * [2000]
        N = len(birth_years)

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = [f"P{x}" for x in list(range(N))]
        df_person["DATE_OF_BIRTH"] = [
            datetime.date(2000, 8, 1),
            datetime.date(2000, 5, 1),
        ] + [None] * (N - 2)

        df_person["DAY_OF_BIRTH"] = [
            None,
            None,
            None,
            None,
            15,
            1,
            None,
        ]
        df_person["MONTH_OF_BIRTH"] = [
            None,
            None,
            8,
            5,
            7,
            7,
            None,
        ]
        df_person["YEAR_OF_BIRTH"] = birth_years
        df_person["INDEX_DATE"] = index_date
        # ages at index = 17, 18, 17, 18, 17, 18, 18

        input_info_person = {
            "name": "PERSON",
            "df": df_person,
        }
        return [input_info_person]

    def define_phenotype_tests(self):
        ages_matching = [17, 18, 17, 18, 17, 18, 18]
        persons = ["P0", "P1", "P2", "P3", "P4", "P5", "P6"]
        allages = {
            "name": "age_ge18_impute_month_day",
            "persons": persons,
            "values": ages_matching,
        }

        test_infos = [allages]

        for test_info in test_infos:
            test_info["phenotype"] = AgePhenotype(
                name=test_info["name"],
                value_filter=ValueFilter(
                    min_value=test_info.get("min_age"),
                    max_value=test_info.get("max_age"),
                ),
                # impute_day=1,
                # impute_month=6,
            )

        return test_infos


def test_age_phenotype():
    spg = AgePhenotypeTestGenerator()
    spg.run_tests()


# def test_impute_month_age_phenotype():
#     spg = AgePhenotypeImputeMonthDayTestGenerator()
#     spg.run_tests()

if __name__ == "__main__":
    test_age_phenotype()
    # test_impute_month_age_phenotype()
