import datetime, os
import pandas as pd

from phenex.filters.value import (
    GreaterThanOrEqualTo,
    LessThanOrEqualTo,
)
from phenex.phenotypes.measurement_phenotype import MeasurementPhenotype
from phenex.phenotypes.measurement_change_phenotype import MeasurementChangePhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.aggregators import *
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class MeasurementChangePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "mcp_test"

    def define_input_tables(self):
        df = pd.DataFrame()
        N = 10
        df["VALUE"] = (
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            + [2, 4, 6, 8, 10, 6, 6, 6, 6, 6]
            + [3, 4, 6, 7]
        )
        df["PERSON_ID"] = [f"P{x}" for x in range(N)] * 2 + ["P0"] * 4
        # change of 1, 2, 3, 4, 5, 0, -1, -2, -3, -4
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["EVENT_DATE"] = (
            [datetime.date(2022, 1, 1)] * 10
            + [datetime.date(2022, 1, 1 + i) for i in range(10)]
            + [
                datetime.date(2022, 1, 3),
                datetime.date(2022, 1, 4),
                datetime.date(2022, 1, 5),
                datetime.date(2022, 1, 6),
            ]
        )
        # days_between = 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
        df.iloc[-1, 0] = None  # make a null lab value for last patient
        return [{"name": "MEASUREMENT", "df": df}]

    def define_phenotype_tests(self):
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )
        measurement_phenotype = MeasurementPhenotype(
            name="measurement",
            codelist=codelist_factory.get_codelist("c1"),
            domain="MEASUREMENT",
            return_date="all",
        )

        c1 = {
            "name": "change_geq2",
            "persons": ["P0", "P1", "P2", "P3", "P4"],
            "phenotype": MeasurementChangePhenotype(
                name="change_geq2",
                phenotype=measurement_phenotype,
                min_change=GreaterThanOrEqualTo(2),
                component_date_select="second",
            ),
        }

        c2 = {
            "name": "change_leq2",
            "persons": ["P0", "P1"],
            "phenotype": MeasurementChangePhenotype(
                name="change_leq2",
                phenotype=measurement_phenotype,
                min_change=GreaterThanOrEqualTo(0),
                max_change=LessThanOrEqualTo(2),
                min_days_between=GreaterThanOrEqualTo(0),
                max_days_between=LessThanOrEqualTo(3),
                component_date_select="second",
            ),
        }

        c3 = {
            "name": "change_leq0",
            "persons": ["P5", "P6", "P7"],
            "phenotype": MeasurementChangePhenotype(
                name="change_leq0",
                phenotype=measurement_phenotype,
                max_change=LessThanOrEqualTo(0),
                min_days_between=GreaterThanOrEqualTo(0),
                max_days_between=LessThanOrEqualTo(7),
                component_date_select="second",
            ),
        }

        c4 = {
            "name": "change_leq0_last_date",
            "persons": ["P0", "P1"],
            "phenotype": MeasurementChangePhenotype(
                name="change_leq0_last_date",
                phenotype=measurement_phenotype,
                min_change=GreaterThanOrEqualTo(0),
                max_change=LessThanOrEqualTo(2),
                min_days_between=GreaterThanOrEqualTo(0),
                max_days_between=LessThanOrEqualTo(3),
                return_date="last",
            ),
        }

        test_infos = [c1, c2, c3, c4]
        return test_infos


def test_measurement_change_phenotype():
    spg = MeasurementChangePhenotypeTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_measurement_change_phenotype()
