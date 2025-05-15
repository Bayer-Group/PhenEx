import datetime, os
import pandas as pd

from phenex.phenotypes import CodelistPhenotype, WithinSameEncounterPhenotype
from phenex.codelists.codelists import Codelist
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import *


class WithinSameEncounterPhenotypeTestGenerator(PhenotypeTestGenerator):
    name_space = "wsept"

    def define_input_tables(self):
        min_days = datetime.timedelta(days=90)
        max_days = datetime.timedelta(days=180)
        one_day = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)

        # pass  patient 0 : has proc1 + cond1 within same encounter, proc BEFORE index_date
        # fail  patient 1 : has proc1 + cond1, NOT within same encounter
        # fail  patient 2 : has proc2 + cond1, within same encounter
        # fail  patient 3 : has proc1 + cond2, within same encounter
        # fail  patient 4 : has proc2 + cond2, within same encounter
        # fail  patient 5 : has proc1 + cond1, NOT within same encounter, cond1 encounter null
        # fail  patient 6 : has proc1 + cond1, NOT within same encounter, proc1 encounter null
        # fail  patient 7 : has proc1 + cond1, NOT within same encounter, proc1 encounter null
        # p/f   patient 8 : has proc1 + cond1 within same encounter, proc AFTER index_date

        df_proc = pd.DataFrame()
        df_proc["PERSON_ID"] = [f"P{i}" for i in range(8)]
        df_proc["CODE"] = ["p1", "p1", "p2", "p1", "p2", "p1", "p1", "p1"]
        df_proc["VISIT_OCCURRENCE_ID"] = [
            "v1",
            "v2",
            "v1",
            "v1",
            "v1",
            "v1",
            None,
            "v1",
        ]
        df_proc["EVENT_DATE"] = [
            index_date - one_day,
            index_date - one_day,
            index_date - one_day,
            index_date,
            index_date + one_day,
            index_date + one_day,
            index_date + one_day,
            index_date + one_day,
        ]

        df_cond = pd.DataFrame()
        df_cond["PERSON_ID"] = [f"P{i}" for i in range(8)]
        df_cond["CODE"] = ["c1", "c1", "c1", "c2", "c2", "c1", "c1", "c1"]
        df_cond["VISIT_OCCURRENCE_ID"] = [
            "v1",
            "v1",
            "v1",
            "v1",
            "v1",
            None,
            "v1",
            "v1",
        ]
        df_cond["EVENT_DATE"] = [index_date] * 8

        return [
            {"name": "CONDITION_OCCURRENCE", "df": df_cond},
            {"name": "PROCEDURE_OCCURRENCE", "df": df_proc},
        ]

    def define_phenotype_tests(self):
        cond = CodelistPhenotype(
            name="condition", domain="CONDITION_OCCURRENCE", codelist=Codelist("c1")
        )
        proc = CodelistPhenotype(
            name="procedure", domain="PROCEDURE_OCCURRENCE", codelist=Codelist("p1")
        )

        proc_on_cond_hospitalization = WithinSameEncounterPhenotype(
            name="proc_on_cond",
            anchor_phenotype=cond,
            phenotype=proc,
            column_name="VISIT_OCCURRENCE_ID",
        )

        t1 = {
            "name": "proc_on_cond",
            "persons": ["P0", "P7"],
            "phenotype": proc_on_cond_hospitalization,
        }

        # Test with relative time range filter procedure must be PRIOR to index
        proc_prior_index = CodelistPhenotype(
            name="procedure_prior_index",
            domain="PROCEDURE_OCCURRENCE",
            codelist=Codelist("p1"),
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(0), when="before", anchor_phenotype=cond
            ),
        )

        proc_on_cond_prior_index = WithinSameEncounterPhenotype(
            name="proc_on_cond_prior_index",
            anchor_phenotype=cond,
            phenotype=proc_prior_index,
            column_name="VISIT_OCCURRENCE_ID",
        )

        t2 = {
            "name": "proc_on_cond",
            "persons": ["P0"],
            "phenotype": proc_on_cond_prior_index,
        }

        # Test with relative time range filter procedure must be POST to index
        proc_post_index = CodelistPhenotype(
            name="procedure_post_index",
            domain="PROCEDURE_OCCURRENCE",
            codelist=Codelist("p1"),
            relative_time_range=RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(0), when="after", anchor_phenotype=cond
            ),
        )

        proc_on_cond_post_index = WithinSameEncounterPhenotype(
            name="proc_on_cond_post_index",
            anchor_phenotype=cond,
            phenotype=proc_post_index,
            column_name="VISIT_OCCURRENCE_ID",
        )

        t3 = {
            "name": "proc_on_cond_post_index",
            "persons": ["P7"],
            "phenotype": proc_on_cond_post_index,
        }

        return [t1, t2, t3]


def test_within_same_encounter_phenotype():
    tg = WithinSameEncounterPhenotypeTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_within_same_encounter_phenotype()
