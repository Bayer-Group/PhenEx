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
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # With 90-day shift (→ 2022-04-01), all events (Dec 27 – Jan 9) are
        # before the shifted index.  Post-index tests find nothing; pre-index
        # tests gain the persons whose events were originally after index.
        shifted_persons = {
            "mmcpt": [],       # post-index: no events after shifted
            "mmcpt_2": [],     # post-index: no events after shifted
            "mmcpt_3": ["P0", "P3"],  # pre-index: P0 (1d apart) + P3 (original)
            "mmcpt_4": ["P0", "P1", "P3", "P4", "P6"],  # pre-index: ≤2d apart
        }

        for test in tests:
            orig = list(test["persons"])
            shifted = shifted_persons[test["name"]]
            test["persons"] = orig + shifted
            test["index_dates"] = [idx1] * len(orig) + [idx2] * len(shifted)

        return tests


def test_multiindex_measurement_change_increase_decrease():
    tg = MultiIndexMeasurementChangeIncreaseDecreaseTestGenerator()
    tg.run_tests()


def test_multiindex_measurement_change_relative_time_range():
    tg = MultiIndexMeasurementChangeRelativeTimeRangeTestGenerator()
    tg.run_tests()
