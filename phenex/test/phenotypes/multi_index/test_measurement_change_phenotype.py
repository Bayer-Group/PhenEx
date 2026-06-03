import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_measurement_change_phenotype import (
    MeasurementChangeIncreaseDecreasePhenotypeTestGenerator,
    MeasurementChangePhenotypeRelativeTimeRangeTestGenerator,
)


class MultiIndexMeasurementChangeIncreaseDecreaseTestGenerator(
    MultiIndexMixin, MeasurementChangeIncreaseDecreasePhenotypeTestGenerator
):
    name_space = "mi_mcpt_increasedecrease"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = MeasurementChangeIncreaseDecreasePhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = MeasurementChangeIncreaseDecreasePhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexMeasurementChangeRelativeTimeRangeTestGenerator(
    MultiIndexMixin, MeasurementChangePhenotypeRelativeTimeRangeTestGenerator
):
    name_space = "mi_mcpt_relativetimerange"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = MeasurementChangePhenotypeRelativeTimeRangeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = MeasurementChangePhenotypeRelativeTimeRangeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_measurement_change_increase_decrease():
    tg = MultiIndexMeasurementChangeIncreaseDecreaseTestGenerator()
    tg.run_tests()


def test_multiindex_measurement_change_relative_time_range():
    tg = MultiIndexMeasurementChangeRelativeTimeRangeTestGenerator()
    tg.run_tests()
