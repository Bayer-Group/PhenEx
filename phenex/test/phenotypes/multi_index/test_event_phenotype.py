import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_event_phenotype import (
    EventPhenotypeBasicTestGenerator,
    EventPhenotypeRelativeTimeRangeFilterTestGenerator,
)


class MultiIndexEventPhenotypeBasicTestGenerator(
    MultiIndexMixin, EventPhenotypeBasicTestGenerator
):
    name_space = "mi_evpt_basic"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = EventPhenotypeBasicTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = EventPhenotypeBasicTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexEventPhenotypeRelativeTimeRangeFilterTestGenerator(
    MultiIndexMixin, EventPhenotypeRelativeTimeRangeFilterTestGenerator
):
    name_space = "mi_evpt_timerange"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = EventPhenotypeRelativeTimeRangeFilterTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = EventPhenotypeRelativeTimeRangeFilterTestGenerator.define_phenotype_tests(self)
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # With a 90-day shift, the relative distances change so different
        # persons pass each filter at the shifted INDEX_DATE.
        shifted_persons = {
            "max_days_leq_180": ["P1", "P2", "P6", "P7", "P8", "P10", "P11"],
            "max_days_lt_180": ["P2", "P6", "P7", "P8", "P10", "P11"],
            "min_days_geq_90_max_days_leq_180": ["P1", "P2", "P6", "P7"],
            "after_max_days_leq_180": ["P9", "P10", "P12", "P13", "P14"],
            "after_min_gt_90_max_leq_180": ["P12"],
            "range_min_gn90_max_l90": ["P8", "P9", "P10", "P11", "P14"],
            "range_min_gn90_max_leq180": ["P8", "P9", "P10", "P11", "P12", "P13", "P14"],
        }

        for test in tests:
            orig = list(test["persons"])
            shifted = shifted_persons[test["name"]]
            test["persons"] = orig + shifted
            test["index_dates"] = [idx1] * len(orig) + [idx2] * len(shifted)

        return tests


def test_multiindex_event_phenotype_basic():
    tg = MultiIndexEventPhenotypeBasicTestGenerator()
    tg.run_tests()


def test_multiindex_event_phenotype_relative_time_range():
    tg = MultiIndexEventPhenotypeRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()
