"""
Multi-index date variants of codelist phenotype tests.

Each test duplicates input data with a second INDEX_DATE (shifted by 2 years),
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
        tables = CodelistPhenotypeRelativeTimeRangeFilterTestGenerator.define_input_tables(
            self
        )
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = CodelistPhenotypeRelativeTimeRangeFilterTestGenerator.define_phenotype_tests(
            self
        )
        # At shifted INDEX_DATE (2024-01-01) all events are 549-911 days away.
        # No filter with max_days <= 180 matches; no "after" events exist.
        # → no persons match at the shifted INDEX_DATE.
        for info in tests:
            n = len(info["persons"])
            info["index_dates"] = [self._index_date] * n
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
        # At shifted INDEX_DATE, anchor phenotype finds no events within range,
        # so dependent phenotypes also produce no results.
        for info in tests:
            n = len(info["persons"])
            info["index_dates"] = [self._index_date] * n
        return tests


# ── Return-date filter ───────────────────────────────────────────────────


class MultiIndexReturnDateTestGenerator(
    MultiIndexMixin, CodelistPhenotypeReturnDateFilterTestGenerator
):
    name_space = "mi_clpt_return_date"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = CodelistPhenotypeReturnDateFilterTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = CodelistPhenotypeReturnDateFilterTestGenerator.define_phenotype_tests(
            self
        )
        index_date_2 = self._index_date + self.shift

        # At shifted INDEX_DATE (2024-01-01), all events are 639-822 days
        # BEFORE. Tests with time filters produce no matches; tests without
        # time filters still return results.
        for info in tests:
            orig_persons = list(info["persons"])
            orig_dates = list(info["dates"])
            n = len(orig_persons)

            rtr = info.get("relative_time_range")
            rd = info.get("return_date", "first")

            if rtr is not None:
                # Check if this is a "before" filter with no max_days constraint.
                # At shifted INDEX_DATE, ALL events are before it, so they match.
                has_max_days = getattr(rtr, "max_days", None) is not None
                when = getattr(rtr, "when", "before")
                if when == "before" and not has_max_days:
                    # "before" with no max_days: at shifted INDEX all events match.
                    if rd == "last":
                        # Latest c1 event = event_dates[8] (the latest event)
                        info["persons"] = orig_persons + ["P0"]
                        info["dates"] = orig_dates + [self.event_dates[8]]
                        info["index_dates"] = (
                            [self._index_date] * n + [index_date_2]
                        )
                    elif rd == "first":
                        info["persons"] = orig_persons + ["P0"]
                        info["dates"] = orig_dates + [self.event_dates[0]]
                        info["index_dates"] = (
                            [self._index_date] * n + [index_date_2]
                        )
                    else:
                        # "all" before: all c1 events match
                        c1_events = self.event_dates[:3] + self.event_dates[6:9]
                        info["persons"] = orig_persons + ["P0"] * len(c1_events)
                        info["dates"] = orig_dates + c1_events
                        info["index_dates"] = (
                            [self._index_date] * n + [index_date_2] * len(c1_events)
                        )
                else:
                    # Time-filtered with max_days: no events within range at shifted INDEX.
                    info["index_dates"] = [self._index_date] * n
            elif rd == "all":
                # No filter, return all → same events duplicated for shifted INDEX.
                info["persons"] = orig_persons + orig_persons
                info["dates"] = orig_dates + orig_dates
                info["index_dates"] = (
                    [self._index_date] * n + [index_date_2] * n
                )
            elif rd == "first":
                # No filter, first → same earliest event for shifted INDEX.
                info["persons"] = orig_persons + orig_persons
                info["dates"] = orig_dates + orig_dates
                info["index_dates"] = (
                    [self._index_date] * n + [index_date_2] * n
                )

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
