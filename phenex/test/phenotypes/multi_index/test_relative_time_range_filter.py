import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_relative_time_range_filter import (
    CodelistPhenotypeRelativeTimeRangeFilterTestGenerator,
)


class MultiIndexRelativeTimeRangeFilterTestGenerator(
    MultiIndexMixin, CodelistPhenotypeRelativeTimeRangeFilterTestGenerator
):
    name_space = "mi_rtrf"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = CodelistPhenotypeRelativeTimeRangeFilterTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = CodelistPhenotypeRelativeTimeRangeFilterTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_relative_time_range_filter():
    tg = MultiIndexRelativeTimeRangeFilterTestGenerator()
    tg.run_tests()
