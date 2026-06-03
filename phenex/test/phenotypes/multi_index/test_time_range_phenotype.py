import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_time_range_phenotype import (
    TimeRangePhenotypeTestGenerator,
    ContinuousCoverageReturnLastPhenotypeTestGenerator,
    TimeRangePhenotypeWithDateRangeBeforeAllExcludedTestGenerator,
    TimeRangePhenotypeWithDateRangeBeforeReducedDaysTestGenerator,
    TimeRangePhenotypeWithDateRangeAfterAllExcludedTestGenerator,
    TimeRangePhenotypeWithDateRangeAfterReducedDaysTestGenerator,
)


class MultiIndexTimeRangePhenotypeTestGenerator(
    MultiIndexMixin, TimeRangePhenotypeTestGenerator
):
    name_space = "mi_ccpt"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = TimeRangePhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangePhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexContinuousCoverageReturnLastTestGenerator(
    MultiIndexMixin, ContinuousCoverageReturnLastPhenotypeTestGenerator
):
    name_space = "mi_ccpt_returnlast"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = ContinuousCoverageReturnLastPhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = ContinuousCoverageReturnLastPhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexTimeRangeBeforeAllExcludedTestGenerator(
    MultiIndexMixin, TimeRangePhenotypeWithDateRangeBeforeAllExcludedTestGenerator
):
    name_space = "mi_ccpt_daterange_before_all_excluded"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = TimeRangePhenotypeWithDateRangeBeforeAllExcludedTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangePhenotypeWithDateRangeBeforeAllExcludedTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexTimeRangeBeforeReducedDaysTestGenerator(
    MultiIndexMixin, TimeRangePhenotypeWithDateRangeBeforeReducedDaysTestGenerator
):
    name_space = "mi_ccpt_daterange_before_reduced_days"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = TimeRangePhenotypeWithDateRangeBeforeReducedDaysTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangePhenotypeWithDateRangeBeforeReducedDaysTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexTimeRangeAfterAllExcludedTestGenerator(
    MultiIndexMixin, TimeRangePhenotypeWithDateRangeAfterAllExcludedTestGenerator
):
    name_space = "mi_ccpt_daterange_after_all_excluded"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = TimeRangePhenotypeWithDateRangeAfterAllExcludedTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangePhenotypeWithDateRangeAfterAllExcludedTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexTimeRangeAfterReducedDaysTestGenerator(
    MultiIndexMixin, TimeRangePhenotypeWithDateRangeAfterReducedDaysTestGenerator
):
    name_space = "mi_ccpt_daterange_after_reduced_days"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = TimeRangePhenotypeWithDateRangeAfterReducedDaysTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangePhenotypeWithDateRangeAfterReducedDaysTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_time_range_phenotype():
    tg = MultiIndexTimeRangePhenotypeTestGenerator()
    tg.run_tests()


def test_multiindex_continuous_coverage_return_last():
    tg = MultiIndexContinuousCoverageReturnLastTestGenerator()
    tg.run_tests()


def test_multiindex_time_range_before_all_excluded():
    tg = MultiIndexTimeRangeBeforeAllExcludedTestGenerator()
    tg.run_tests()


def test_multiindex_time_range_before_reduced_days():
    tg = MultiIndexTimeRangeBeforeReducedDaysTestGenerator()
    tg.run_tests()


def test_multiindex_time_range_after_all_excluded():
    tg = MultiIndexTimeRangeAfterAllExcludedTestGenerator()
    tg.run_tests()


def test_multiindex_time_range_after_reduced_days():
    tg = MultiIndexTimeRangeAfterReducedDaysTestGenerator()
    tg.run_tests()
