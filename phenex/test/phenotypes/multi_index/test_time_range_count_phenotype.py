import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_time_range_count_phenotype import (
    TimeRangeCountPhenotypeTestGenerator,
)


class MultiIndexTimeRangeCountPhenotypeTestGenerator(
    MultiIndexMixin, TimeRangeCountPhenotypeTestGenerator
):
    name_space = "mi_trcpt"
    _index_date = datetime.date(2020, 5, 15)

    def define_input_tables(self):
        tables = TimeRangeCountPhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangeCountPhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_time_range_count_phenotype():
    tg = MultiIndexTimeRangeCountPhenotypeTestGenerator()
    tg.run_tests()
