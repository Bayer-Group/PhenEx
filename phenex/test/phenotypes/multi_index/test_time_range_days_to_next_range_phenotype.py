import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_time_range_days_to_next_range_phenotype import (
    TimeRangeDaysToNextRangePhenotypeTestGenerator,
)


class MultiIndexTimeRangeDaysToNextRangePhenotypeTestGenerator(
    MultiIndexMixin, TimeRangeDaysToNextRangePhenotypeTestGenerator
):
    name_space = "mi_trdtnrp"
    _index_date = datetime.date(2022, 1, 15)

    def define_input_tables(self):
        tables = TimeRangeDaysToNextRangePhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangeDaysToNextRangePhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_time_range_days_to_next_range_phenotype():
    tg = MultiIndexTimeRangeDaysToNextRangePhenotypeTestGenerator()
    tg.run_tests()
