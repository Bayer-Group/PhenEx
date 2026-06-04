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
        tables = TimeRangeDaysToNextRangePhenotypeTestGenerator.define_input_tables(
            self
        )
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = TimeRangeDaysToNextRangePhenotypeTestGenerator.define_phenotype_tests(
            self
        )
        idx1 = self._index_date

        # At shifted index (2022-04-15), no visit ranges contain the shifted
        # index date, so no anchor range is found and all tests produce empty
        # results at the shifted index.
        for test in tests:
            orig_p = list(test["persons"])
            orig_v = list(test["values"])
            orig_d = list(test["dates"])
            test["persons"] = orig_p
            test["values"] = orig_v
            test["dates"] = orig_d
            test["index_dates"] = [idx1] * len(orig_p)

        return tests


def test_multiindex_time_range_days_to_next_range_phenotype():
    tg = MultiIndexTimeRangeDaysToNextRangePhenotypeTestGenerator()
    tg.run_tests()
