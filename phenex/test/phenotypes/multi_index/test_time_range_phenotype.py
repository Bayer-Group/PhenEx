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
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # At shifted index (2022-04-01), different observation periods contain
        # the index and have different coverage days before it.
        shifted = {
            "coverage_min_geq_90": {
                "persons": ["P15", "P19", "P20", "P22", "P23"],
                "values": [180, 179, 90, 90, 90],
            },
            "coverage_min_gt_90": {
                "persons": ["P15", "P19"],
                "values": [180, 179],
            },
        }

        for test in tests:
            orig_p = list(test["persons"])
            orig_v = list(test["values"])
            s = shifted[test["name"]]
            test["persons"] = orig_p + s["persons"]
            test["values"] = orig_v + s["values"]
            test["index_dates"] = [idx1] * len(orig_p) + [idx2] * len(s["persons"])

        return tests


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
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        def end_date_for(person_id):
            return self.df_input[self.df_input["PERSON_ID"] == person_id]["END_DATE"].values[0]

        # At shifted index (2022-04-01), only periods extending ≥90 days
        # after Apr 1 qualify.
        shifted = {
            "coverage_min_geq_90": {
                "persons": ["P23", "P27"],
                "values": [90, 91],
                "dates": [end_date_for("P23"), end_date_for("P27")],
            },
            "coverage_min_gt_90": {
                "persons": ["P27"],
                "values": [91],
                "dates": [end_date_for("P27")],
            },
        }

        for test in tests:
            orig_p = list(test["persons"])
            orig_v = list(test["values"])
            orig_d = list(test["dates"])
            s = shifted[test["name"]]
            test["persons"] = orig_p + s["persons"]
            test["values"] = orig_v + s["values"]
            test["dates"] = orig_d + s["dates"]
            test["index_dates"] = [idx1] * len(orig_p) + [idx2] * len(s["persons"])

        return tests


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
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # At shifted index (2022-04-01), min_date clips start to 2022-01-02.
        # Periods containing Apr 1 with clipped start ≤ Apr 1 all qualify.
        shifted_persons = ["P15", "P19", "P20", "P22", "P23", "P24", "P25", "P26", "P27"]

        for test in tests:
            orig_p = list(test["persons"])
            n = len(orig_p)
            test["persons"] = orig_p + shifted_persons
            test["index_dates"] = [idx1] * n + [idx2] * len(shifted_persons)

        return tests


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
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # At shifted index (2022-04-01), min_date clips start to max(orig, 2021-11-01).
        # P15/P19 clipped to Nov 1 → 151 days. P20-P23 start Jan 1 → 90 days.
        # P24-P27 start Jan 2 → 89 days.
        shifted_persons = ["P15", "P19", "P20", "P22", "P23", "P24", "P25", "P26", "P27"]
        shifted_values = [151, 151, 90, 90, 90, 89, 89, 89, 89]

        for test in tests:
            orig_p = list(test["persons"])
            orig_v = list(test["values"])
            n = len(orig_p)
            test["persons"] = orig_p + shifted_persons
            test["values"] = orig_v + shifted_values
            test["index_dates"] = [idx1] * n + [idx2] * len(shifted_persons)

        return tests


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
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # At shifted index (2022-04-01), max_date clips end to 2022-02-15.
        # Clipped end < shifted index → no periods contain shifted index → empty.
        for test in tests:
            orig_p = list(test["persons"])
            orig_v = list(test["values"])
            n = len(orig_p)
            test["index_dates"] = [idx1] * n

        return tests


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
