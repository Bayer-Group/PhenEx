import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_further_value_filter_phenotype import (
    FurtherValueFilterBasicTestGenerator,
    FurtherValueFilterAggregationTestGenerator,
    FurtherValueFilterDateRangeTestGenerator,
    FurtherValueFilterRelativeTimeRangeTestGenerator,
    FurtherValueFilterReturnDateTestGenerator,
)


class MultiIndexFurtherValueFilterBasicTestGenerator(
    MultiIndexMixin, FurtherValueFilterBasicTestGenerator
):
    name_space = "mi_fvf_basic"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = FurtherValueFilterBasicTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = FurtherValueFilterBasicTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexFurtherValueFilterAggregationTestGenerator(
    MultiIndexMixin, FurtherValueFilterAggregationTestGenerator
):
    name_space = "mi_fvf_aggregation"
    _index_date = datetime.date(2022, 1, 3)

    def define_input_tables(self):
        tables = FurtherValueFilterAggregationTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = FurtherValueFilterAggregationTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexFurtherValueFilterDateRangeTestGenerator(
    MultiIndexMixin, FurtherValueFilterDateRangeTestGenerator
):
    name_space = "mi_fvf_daterange"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = FurtherValueFilterDateRangeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = FurtherValueFilterDateRangeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexFurtherValueFilterRelativeTimeRangeTestGenerator(
    MultiIndexMixin, FurtherValueFilterRelativeTimeRangeTestGenerator
):
    name_space = "mi_fvf_relativetimerange"
    _index_date = datetime.date(2022, 6, 1)

    def define_input_tables(self):
        tables = FurtherValueFilterRelativeTimeRangeTestGenerator.define_input_tables(
            self
        )
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = FurtherValueFilterRelativeTimeRangeTestGenerator.define_phenotype_tests(
            self
        )
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexFurtherValueFilterReturnDateTestGenerator(
    MultiIndexMixin, FurtherValueFilterReturnDateTestGenerator
):
    name_space = "mi_fvf_returndate"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = FurtherValueFilterReturnDateTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = FurtherValueFilterReturnDateTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_further_value_filter_basic():
    tg = MultiIndexFurtherValueFilterBasicTestGenerator()
    tg.run_tests()


def test_multiindex_further_value_filter_aggregation():
    tg = MultiIndexFurtherValueFilterAggregationTestGenerator()
    tg.run_tests()


def test_multiindex_further_value_filter_date_range():
    tg = MultiIndexFurtherValueFilterDateRangeTestGenerator()
    tg.run_tests()


def test_multiindex_further_value_filter_relative_time_range():
    tg = MultiIndexFurtherValueFilterRelativeTimeRangeTestGenerator()
    tg.run_tests()


def test_multiindex_further_value_filter_return_date():
    tg = MultiIndexFurtherValueFilterReturnDateTestGenerator()
    tg.run_tests()
