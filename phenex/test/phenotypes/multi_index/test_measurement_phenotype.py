import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_measurement_phenotype import (
    MeasurementPhenotypeRelativeTimeRangeFilterTestGenerator,
)


class MultiIndexMeasurementPhenotypeRelativeTimeRangeTestGenerator(
    MultiIndexMixin, MeasurementPhenotypeRelativeTimeRangeFilterTestGenerator
):
    name_space = "mi_mmpt_relativetimerange"
    _index_date = datetime.date(2022, 1, 2)

    def define_input_tables(self):
        tables = MeasurementPhenotypeRelativeTimeRangeFilterTestGenerator.define_input_tables(
            self
        )
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = MeasurementPhenotypeRelativeTimeRangeFilterTestGenerator.define_phenotype_tests(
            self
        )
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_measurement_phenotype_relative_time_range():
    tg = MultiIndexMeasurementPhenotypeRelativeTimeRangeTestGenerator()
    tg.run_tests()
