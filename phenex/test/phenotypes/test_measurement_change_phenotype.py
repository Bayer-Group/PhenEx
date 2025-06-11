import datetime, os
import pandas as pd

import itertools, copy, random

from phenex.filters.value import (
    GreaterThanOrEqualTo,
    GreaterThan,
    LessThanOrEqualTo,
    LessThan,
)
from phenex.filters import RelativeTimeRangeFilter
from phenex.phenotypes.measurement_phenotype import MeasurementPhenotype
from phenex.phenotypes.measurement_change_phenotype import MeasurementChangePhenotype
from phenex.codelists import LocalCSVCodelistFactory, Codelist
from phenex.aggregators import *
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


def measurement_changes_pandas(
    df,
    min_change,
    max_change,
    min_days_between,
    max_days_between,
    component_date_select="first",
    return_date="all",
):
    """
    A reimplementation of MeasurementChangePhenotype in pandas
    """
    df = copy.deepcopy(df)
    df.loc[:, "EVENT_DATE"] = pd.to_datetime(df["EVENT_DATE"]).dt.date
    x = df.merge(df, on="PERSON_ID", suffixes=["_1", "_2"])
    x.loc[:, "DATE_DELTA"] = pd.to_timedelta(
        x["EVENT_DATE_2"] - x["EVENT_DATE_1"]
    ).dt.days
    x.loc[:, "DELTA"] = x["VALUE_2"] - x["VALUE_1"]

    filtered_x = x[x["DATE_DELTA"] > 0]
    if min_change:
        if min_change.operator == ">":
            filtered_x = filtered_x[(filtered_x["DELTA"] > min_change.value)]
        else:
            filtered_x = filtered_x[(filtered_x["DELTA"] >= min_change.value)]
    if max_change:
        if max_change.operator == "<":
            filtered_x = filtered_x[(filtered_x["DELTA"] < max_change.value)]
        else:
            filtered_x = filtered_x[(filtered_x["DELTA"] <= max_change.value)]
    if min_days_between:
        if min_days_between.operator == ">":
            filtered_x = filtered_x[(filtered_x["DATE_DELTA"] > min_days_between.value)]
        else:
            filtered_x = filtered_x[
                (filtered_x["DATE_DELTA"] >= min_days_between.value)
            ]
    if max_days_between:
        if max_days_between.operator == "<":
            filtered_x = filtered_x[(filtered_x["DATE_DELTA"] < max_days_between.value)]
        else:
            filtered_x = filtered_x[
                (filtered_x["DATE_DELTA"] <= max_days_between.value)
            ]
    if component_date_select == "first":
        filtered_x.loc[:, "EVENT_DATE"] = filtered_x["EVENT_DATE_1"]
    else:
        filtered_x.loc[:, "EVENT_DATE"] = filtered_x["EVENT_DATE_2"]
    if return_date == "first":
        filtered_x.loc[:, "rank"] = filtered_x.groupby("PERSON_ID")["EVENT_DATE"].rank(
            method="first"
        )
        filtered_x = filtered_x[filtered_x["rank"] == 1].reset_index(drop=True)
    elif return_date == "last":
        filtered_x.loc[:, "rank"] = filtered_x.groupby("PERSON_ID")["EVENT_DATE"].rank(
            method="first", ascending=False
        )
        filtered_x = filtered_x[filtered_x["rank"] == 1].reset_index(drop=True)

    filtered_x.loc[:, "VALUE"] = filtered_x["DELTA"]

    return filtered_x


class MeasurementChangePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "mcp_test"
    test_date = True
    test_values = True

    def define_input_tables(self):
        import random

        random.seed(1234)
        df = pd.DataFrame()
        N = 50
        persons = []
        event_dates = []
        values = []
        for person in range(N):
            n_samples = (person // 2) + 1
            persons += [f"P{person}"] * n_samples
            event_dates += [datetime.date(2022, 1, 1 + i) for i in range(n_samples)]
            values += list(
                random.choices([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, None], k=n_samples)
            )

        assert len(persons) == len(values) == len(event_dates)

        df["VALUE"] = values
        df["PERSON_ID"] = persons
        df["CODE"] = "c1"
        df["CODE_TYPE"] = "ICD10CM"
        df["EVENT_DATE"] = event_dates
        self.df = df
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

        test_infos = []
        min_change_options = [GreaterThanOrEqualTo(2), GreaterThan(2), None]
        max_change_options = [LessThanOrEqualTo(3), LessThan(2), None]
        min_days_between_options = [GreaterThanOrEqualTo(0), GreaterThan(0), None]
        max_days_between_options = [LessThanOrEqualTo(7), LessThan(4), None]
        component_date_select_options = ["first", "second"]
        return_date_options = ["all"]
        for j, (
            min_change,
            max_change,
            min_days_between,
            max_days_between,
            return_date,
        ) in enumerate(
            itertools.product(
                min_change_options,
                max_change_options,
                min_days_between_options,
                max_days_between_options,
                return_date_options,
            )
        ):
            component_date_select = random.choices(
                random.choices(component_date_select_options, k=1)
            )[0]
            df = measurement_changes_pandas(
                self.df,
                min_change,
                max_change,
                min_days_between,
                max_days_between,
                component_date_select=component_date_select,
                return_date=return_date,
            )
            if j == 75:
                if min_change:
                    print(f"min_change {min_change.operator} {min_change.value}")
                if max_change:
                    print(f"max_change {max_change.operator} {max_change.value}")
                if min_days_between:
                    print(
                        f"min_days_between {min_days_between.operator} {min_days_between.value}"
                    )
                if max_days_between:
                    print(
                        f"max_days_between {max_days_between.operator} {max_days_between.value}"
                    )
                print(f"component_date_select = {component_date_select}")
                print(f"return_date = {return_date}")
                # import pdb
                # pdb.set_trace()
            # else:/
            # continue

            if len(df):
                test = {
                    "name": f"change_{j}",
                    "persons": df.PERSON_ID,
                    "values": df.VALUE,
                    "dates": df.EVENT_DATE,
                    "phenotype": MeasurementChangePhenotype(
                        name=f"change_{j}",
                        phenotype=measurement_phenotype,
                        min_change=min_change,
                        max_change=max_change,
                        min_days_between=min_days_between,
                        max_days_between=max_days_between,
                        component_date_select=component_date_select,
                        return_date=return_date,
                        return_value=None,
                    ),
                }
                test_infos.append(test)

        return test_infos


class MeasurementChangeIncreaseDecreasePhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "mcpt_increasedecrease"

    def define_input_tables(self):
        df = pd.DataFrame()

        measurements = [
            12,
            9,  # P0
            12,
            10,  # P1
            12,
            11,  # P2
            12,
            12,  # P3
            12,
            13,  # P4
            12,
            14,  # P5
            12,
            15,  # P6
        ]

        one_day = datetime.timedelta(days=1)
        event_date = datetime.date(2022, 2, 1)
        index_date = datetime.date(2022, 1, 1)

        event_dates = [
            event_date,
            event_date + one_day,
            event_date,
            event_date + one_day,
            event_date,
            event_date + one_day,
            event_date,
            event_date + one_day,
            event_date,
            event_date + one_day,
            event_date,
            event_date + one_day,
            event_date,
            event_date + one_day,
        ]
        person_id = [
            "P0",
            "P0",
            "P1",
            "P1",
            "P2",
            "P2",
            "P3",
            "P3",
            "P4",
            "P4",
            "P5",
            "P5",
            "P6",
            "P6",
        ]

        df["VALUE"] = measurements
        df["INDEX_DATE"] = index_date
        df["EVENT_DATE"] = event_dates
        df["CODE_TYPE"] = None
        df["CODE"] = "hb"
        df["PERSON_ID"] = person_id

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "MEASUREMENT", "df": df},
        ]

    def define_phenotype_tests(self):
        # create measurement phenotype
        mmpt = MeasurementPhenotype(
            name="mmpt",
            codelist=Codelist(["hb"], use_code_type=False),
            domain="MEASUREMENT",
            return_date="all",
        )

        # TEST decrease >2
        mmcpt = MeasurementChangePhenotype(
            name="mmcpt",
            phenotype=mmpt,
            min_change=GreaterThan(2),
            max_days_between=LessThan(2),
            direction="decrease",
            return_date="last",
        )

        t1 = {"name": "mmcpt", "persons": ["P0"], "phenotype": mmcpt}

        # TEST decrease >=2
        mmcpt2 = MeasurementChangePhenotype(
            name="mmcpt_2",
            phenotype=mmpt,
            min_change=GreaterThanOrEqualTo(2),
            max_days_between=LessThan(2),
            direction="decrease",
            return_date="last",
        )

        t2 = {"name": "mmcpt_2", "persons": ["P0", "P1"], "phenotype": mmcpt2}

        # TEST increase >2
        mmcpt3 = MeasurementChangePhenotype(
            name="mmcpt_3",
            phenotype=mmpt,
            min_change=GreaterThan(2),
            max_days_between=LessThan(2),
            direction="increase",
            return_date="last",
        )

        t3 = {"name": "mmcpt_3", "persons": ["P6"], "phenotype": mmcpt3}

        # TEST increase >=2
        mmcpt4 = MeasurementChangePhenotype(
            name="mmcpt_4",
            phenotype=mmpt,
            min_change=GreaterThanOrEqualTo(2),
            max_days_between=LessThan(2),
            direction="increase",
            return_date="last",
        )

        t4 = {"name": "mmcpt_4", "persons": ["P5", "P6"], "phenotype": mmcpt4}

        test_infos = [t1, t2, t3, t4]

        return test_infos


class MeasurementChangePhenotypeRelativeTimeRangeTestGenerator(PhenotypeTestGenerator):
    name_space = "mcpt_relativetimerange"

    def define_input_tables(self):
        df = pd.DataFrame()

        measurements = [
            12,
            9,  # P0
            12,
            9,  # P1
            12,
            9,  # P2
            12,
            9,  # P3
            12,
            9,  # P4
            12,
            9,  # P5
            12,
            9,  # P6
        ]

        day = datetime.timedelta(days=1)
        event_date = datetime.date(2022, 10, 1)
        index_date = datetime.date(2022, 1, 1)

        event_dates = [
            index_date + day * 5,
            index_date + day * 6,
            index_date + day * 5,
            index_date + day * 7,
            index_date + day * 5,
            index_date + day * 8,
            index_date - day * 5,
            index_date - day * 4,
            index_date - day * 5,
            index_date - day * 3,
            index_date - day * 5,
            index_date - day * 2,
            index_date - day,
            index_date + day,
        ]
        person_id = [
            "P0",
            "P0",
            "P1",
            "P1",
            "P2",
            "P2",
            "P3",
            "P3",
            "P4",
            "P4",
            "P5",
            "P5",
            "P6",
            "P6",
        ]

        df["VALUE"] = measurements
        df["INDEX_DATE"] = index_date
        df["EVENT_DATE"] = event_dates
        df["CODE_TYPE"] = None
        df["CODE"] = "hb"
        df["PERSON_ID"] = person_id

        df_person = pd.DataFrame()
        df_person["PERSON_ID"] = list(df["PERSON_ID"].unique())

        return [
            {"name": "MEASUREMENT", "df": df},
        ]

    def define_phenotype_tests(self):
        # create measurement phenotype
        mmpt_postindex = MeasurementPhenotype(
            name="mmpt",
            codelist=Codelist(["hb"], use_code_type=False),
            domain="MEASUREMENT",
            return_date="all",
            relative_time_range=RelativeTimeRangeFilter(
                when="after", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        # create measurement phenotype
        mmpt_preindex = MeasurementPhenotype(
            name="mmpt",
            codelist=Codelist(["hb"], use_code_type=False),
            domain="MEASUREMENT",
            return_date="all",
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        mmpt_anytime = MeasurementPhenotype(
            name="mmpt",
            codelist=Codelist(["hb"], use_code_type=False),
            domain="MEASUREMENT",
            return_date="all",
        )

        # TEST post index >2 days apart
        mmcpt = MeasurementChangePhenotype(
            name="mmcpt",
            phenotype=mmpt_postindex,
            min_change=GreaterThan(2),
            max_days_between=LessThan(2),
            direction="decrease",
            return_date="last",
        )

        t1 = {"name": "mmcpt", "persons": ["P0"], "phenotype": mmcpt}

        # TEST post index >=2 days apart
        mmcpt2 = MeasurementChangePhenotype(
            name="mmcpt_2",
            phenotype=mmpt_postindex,
            min_change=GreaterThanOrEqualTo(2),
            max_days_between=LessThanOrEqualTo(2),
            direction="decrease",
            return_date="last",
        )

        t2 = {"name": "mmcpt_2", "persons": ["P0", "P1"], "phenotype": mmcpt2}

        # TEST pre index >2 days apart
        mmcpt3 = MeasurementChangePhenotype(
            name="mmcpt_3",
            phenotype=mmpt_preindex,
            min_change=GreaterThan(2),
            max_days_between=LessThan(2),
            direction="decrease",
            return_date="last",
        )

        t3 = {"name": "mmcpt_3", "persons": ["P3"], "phenotype": mmcpt3}

        # TEST pre index >=2 days apart
        mmcpt4 = MeasurementChangePhenotype(
            name="mmcpt_4",
            phenotype=mmpt_preindex,
            min_change=GreaterThanOrEqualTo(2),
            max_days_between=LessThanOrEqualTo(2),
            direction="decrease",
            return_date="last",
        )

        t4 = {"name": "mmcpt_4", "persons": ["P3", "P4"], "phenotype": mmcpt4}

        test_infos = [t1, t2, t3, t4]

        return test_infos


def test_measurement_change_phenotype():
    spg = MeasurementChangePhenotypeTestGenerator()
    spg.run_tests()


def test_measurement_change_phenotype_increase_decrease():
    spg = MeasurementChangeIncreaseDecreasePhenotypeTestGenerator()
    spg.run_tests()


def test_measurement_change_phenotype_relative_time_range():
    spg = MeasurementChangePhenotypeRelativeTimeRangeTestGenerator()
    spg.run_tests()


if __name__ == "__main__":
    test_measurement_change_phenotype()
    test_measurement_change_phenotype_increase_decrease()
    test_measurement_change_phenotype_relative_time_range()
