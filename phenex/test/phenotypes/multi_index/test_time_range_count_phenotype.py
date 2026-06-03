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
        idx1 = self._index_date
        idx2 = idx1 + self._shift

        # At shifted index (2020-08-13), p1-p4 are all "before", only p5 is "after" (19 days after).
        shifted = {
            "count_all_visits": {"persons": ["P1", "P2"], "values": [5, 1]},
            "count_visits_after_index": {"persons": ["P1", "P2"], "values": [1, 0]},
            "count_visits_before_index": {"persons": ["P1", "P2"], "values": [4, 1]},
            "max_days_set": {"persons": ["P1", "P2"], "values": [1, 0]},
            "min_days_set": {"persons": ["P1", "P2"], "values": [0, 0]},
            "min_days_set_with_value_filter": {"persons": [], "values": []},
            "value_filter": {"persons": ["P1"], "values": [5]},
            "date_range_filter": {"persons": ["P1", "P2"], "values": [3, 0]},
        }

        for test in tests:
            orig_p = list(test["persons"])
            orig_v = list(test["values"])
            s = shifted[test["name"]]
            test["persons"] = orig_p + s["persons"]
            test["values"] = orig_v + s["values"]
            test["index_dates"] = [idx1] * len(orig_p) + [idx2] * len(s["persons"])

        return tests


def test_multiindex_time_range_count_phenotype():
    tg = MultiIndexTimeRangeCountPhenotypeTestGenerator()
    tg.run_tests()
