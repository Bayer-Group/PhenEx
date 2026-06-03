import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_time_range_day_count_phenotype import (
    TimeRangeDayCountPhenotypeTestGenerator,
)


class MultiIndexTimeRangeDayCountPhenotypeTestGenerator(
    MultiIndexMixin, TimeRangeDayCountPhenotypeTestGenerator
):
    name_space = "mi_trdcpt"
    _index_date = datetime.date(2020, 5, 15)

    def define_input_tables(self):
        tables = TimeRangeDayCountPhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangeDayCountPhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_time_range_day_count_phenotype():
    tg = MultiIndexTimeRangeDayCountPhenotypeTestGenerator()
    tg.run_tests()
