"""
Multi-index date variants of codelist phenotype tests.

Each test duplicates input data with a second INDEX_DATE (shifted by 90 days),
verifying that phenotype logic correctly partitions results by (PERSON_ID, INDEX_DATE).
Only includes tests whose input data contained an INDEX_DATE column.
"""

import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_codelist_phenotype import (
    CodelistPhenotypeRelativeTimeRangeFilterTestGenerator,
    CodelistPhenotypeAnchorPhenotypeRelativeTimeRangeFilterTestGenerator,
    CodelistPhenotypeReturnDateFilterTestGenerator,
)


# ── Relative time-range filter (INDEX_DATE as anchor) ────────────────────


class MultiIndexRelativeTimeRangeFilterTestGenerator(
    MultiIndexMixin, CodelistPhenotypeRelativeTimeRangeFilterTestGenerator
):
    name_space = "mi_clpt_timerangefilter"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = (
            CodelistPhenotypeRelativeTimeRangeFilterTestGenerator.define_input_tables(
                self
            )
        )
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = CodelistPhenotypeRelativeTimeRangeFilterTestGenerator.define_phenotype_tests(
            self
        )
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # With a 90-day shift, relative distances change so different
        # persons pass each filter at the shifted INDEX_DATE.
        shifted_persons = {
            "max_days_leq_180": ["P1", "P2", "P6", "P7", "P8", "P10", "P11"],
            "max_days_lt_180": ["P2", "P6", "P7", "P8", "P10", "P11"],
            "min_days_geq_90_max_days_leq_180": ["P1", "P2", "P6", "P7"],
            "after_max_days_leq_180": ["P9", "P10", "P12", "P13", "P14"],
            "after_max_days_g_90_max_days_leq_180": ["P12"],
            "range_min_gn90_max_g90": ["P8", "P9", "P10", "P11", "P14"],
            "range_min_gn90_max_ge180": ["P8", "P9", "P10", "P11", "P12", "P13", "P14"],
        }

        for test in tests:
            orig = list(test["persons"])
            shifted = shifted_persons[test["name"]]
            test["persons"] = orig + shifted
            test["index_dates"] = [idx1] * len(orig) + [idx2] * len(shifted)

        return tests


# ── Anchor phenotype relative time-range filter ──────────────────────────


class MultiIndexAnchorPhenotypeTestGenerator(
    MultiIndexMixin,
    CodelistPhenotypeAnchorPhenotypeRelativeTimeRangeFilterTestGenerator,
):
    name_space = "mi_clpt_anchor_phenotype"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = CodelistPhenotypeAnchorPhenotypeRelativeTimeRangeFilterTestGenerator.define_input_tables(
            self
        )
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = CodelistPhenotypeAnchorPhenotypeRelativeTimeRangeFilterTestGenerator.define_phenotype_tests(
            self
        )
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # At shifted INDEX_DATE (2022-04-01):
        # - phenotypeindex1 (>0, ≤90 before): matches P10-P14 (anchor=2022-01-01)
        # - phenotypeindex2 (≥0, ≤180 before): matches P5-P9, P10-P14, P15-P19
        # Then dependent phenotypes filter c2 events relative to anchors.
        shifted_persons = {
            "p1": ["P10"],
            "p2": ["P6", "P7", "P11", "P12", "P16", "P17"],
            "p4": ["P6", "P7", "P8", "P11", "P12", "P13", "P16", "P17", "P18"],
        }

        for test in tests:
            orig = list(test["persons"])
            shifted = shifted_persons[test["name"]]
            test["persons"] = orig + shifted
            test["index_dates"] = [idx1] * len(orig) + [idx2] * len(shifted)

        return tests


# ── Return-date filter ───────────────────────────────────────────────────


class MultiIndexReturnDateTestGenerator(
    MultiIndexMixin, CodelistPhenotypeReturnDateFilterTestGenerator
):
    name_space = "mi_clpt_return_date"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = CodelistPhenotypeReturnDateFilterTestGenerator.define_input_tables(
            self
        )
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = CodelistPhenotypeReturnDateFilterTestGenerator.define_phenotype_tests(
            self
        )
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # At shifted INDEX_DATE (2022-04-01), c1 events for P0 have new
        # relative distances.  Compute correct expected output per test.
        for info in tests:
            orig_persons = list(info["persons"])
            orig_dates = list(info["dates"])
            n = len(orig_persons)
            name = info["name"]

            if name == "returndate":
                # return_date="all", no filter → all 6 c1 events at both INDEX_DATEs
                info["persons"] = orig_persons + orig_persons
                info["dates"] = orig_dates + orig_dates
                info["index_dates"] = [idx1] * n + [idx2] * n

            elif name == "l90":
                # return_date="all", before, max_days < 90
                # Shifted: events[6]=2022-03-31 (1d), events[7]=2022-04-01 (0d)
                sp = ["P0", "P0"]
                sd = [self.event_dates[6], self.event_dates[7]]
                info["persons"] = orig_persons + sp
                info["dates"] = orig_dates + sd
                info["index_dates"] = [idx1] * n + [idx2] * len(sp)

            elif name == "leq90":
                # return_date="all", before, max_days ≤ 90
                # Shifted: events[6] (1d), events[7] (0d)
                sp = ["P0", "P0"]
                sd = [self.event_dates[6], self.event_dates[7]]
                info["persons"] = orig_persons + sp
                info["dates"] = orig_dates + sd
                info["index_dates"] = [idx1] * n + [idx2] * len(sp)

            elif name == "first_preindex":
                # return_date="first", no filter → earliest c1 = events[0]
                info["persons"] = orig_persons + ["P0"]
                info["dates"] = orig_dates + [self.event_dates[0]]
                info["index_dates"] = [idx1] * n + [idx2]

            elif name == "last_preindex":
                # return_date="last", before → events[7] (on shifted index)
                info["persons"] = orig_persons + ["P0"]
                info["dates"] = orig_dates + [self.event_dates[7]]
                info["index_dates"] = [idx1] * n + [idx2]

            elif name == "first_leq90":
                # return_date="first", before, max_days ≤ 90 → events[6]
                info["persons"] = orig_persons + ["P0"]
                info["dates"] = orig_dates + [self.event_dates[6]]
                info["index_dates"] = [idx1] * n + [idx2]

            elif name == "last_postindex":
                # return_date="last", after → events[8]
                info["persons"] = orig_persons + ["P0"]
                info["dates"] = orig_dates + [self.event_dates[8]]
                info["index_dates"] = [idx1] * n + [idx2]

            elif name == "first_postindex":
                # return_date="first", after → events[7] (on shifted index)
                info["persons"] = orig_persons + ["P0"]
                info["dates"] = orig_dates + [self.event_dates[7]]
                info["index_dates"] = [idx1] * n + [idx2]

            elif name == "postindex_leq90":
                # return_date="all", after, max_days ≤ 90 → events[7], events[8]
                sp = ["P0", "P0"]
                sd = [self.event_dates[7], self.event_dates[8]]
                info["persons"] = orig_persons + sp
                info["dates"] = orig_dates + sd
                info["index_dates"] = [idx1] * n + [idx2] * len(sp)

        return tests


# ── Test functions ────────────────────────────────────────────────────────


def test_multiindex_relative_time_range_filter():
    tg = MultiIndexRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()


def test_multiindex_anchor_phenotype():
    tg = MultiIndexAnchorPhenotypeTestGenerator()
    tg.run_tests()


def test_multiindex_return_date():
    tg = MultiIndexReturnDateTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_multiindex_relative_time_range_filter()
    test_multiindex_anchor_phenotype()
    test_multiindex_return_date()
