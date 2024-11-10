import datetime, os
import pandas as pd

from phenx.phenotypes.codelist_phenotype import CodelistPhenotype
from phenx.codelists import LocalCSVCodelistFactory
from phenx.filters.date_range_filter import DateRangeFilter
from phenx.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenx.test.util.dummy.generate_dummy_data import (
    sdf_and_tt_dummycodes_3variables,
)
from phenx.test.phenotype_test_generator import PhenotypeTestGenerator
from phenx.filters.value import (
    GreaterThan,
    GreaterThanOrEqualTo,
    LessThan,
    LessThanOrEqualTo,
    EqualTo,
)


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


def test_anchor_phenotype():
    tg = CodelistPhenotypeAnchorPhenotypeRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()
