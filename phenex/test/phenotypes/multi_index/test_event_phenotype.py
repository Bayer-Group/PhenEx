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
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_event_phenotype_basic():
    tg = MultiIndexEventPhenotypeBasicTestGenerator()
    tg.run_tests()


def test_multiindex_event_phenotype_relative_time_range():
    tg = MultiIndexEventPhenotypeRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()
