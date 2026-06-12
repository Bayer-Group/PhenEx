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
        idx1 = self._index_date
        idx2 = idx1 + self._shift

        # At shifted index (2020-08-13), p1-p4 are entirely before shifted,
        # only p5 (Sep 1-30) is after (starts 19 days after shifted).
        # Day-level clipping applies for min/max_days constraints.
        shifted = {
            "count_all_days": {"persons": ["P1", "P2"], "values": [150, 30]},
            "count_days_before_index": {"persons": ["P1", "P2"], "values": [120, 30]},
            "count_days_after_index": {"persons": ["P1", "P2"], "values": [30, 0]},
            "count_days_after_min30": {"persons": ["P1", "P2"], "values": [19, 0]},
            "count_days_after_max90": {"persons": ["P1", "P2"], "values": [30, 0]},
            "count_days_after_30to90": {"persons": ["P1", "P2"], "values": [19, 0]},
            "count_days_min100": {"persons": ["P1"], "values": [150]},
            "count_days_before_min30": {"persons": ["P1", "P2"], "values": [104, 30]},
            "date_range_max_end_date": {"persons": ["P1", "P2"], "values": [45, 30]},
            "date_range_min_start_date": {"persons": ["P1", "P2"], "values": [46, 0]},
            "date_range_combined_start_and_end": {
                "persons": ["P1", "P2"],
                "values": [61, 0],
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


def test_multiindex_time_range_day_count_phenotype():
    tg = MultiIndexTimeRangeDayCountPhenotypeTestGenerator()
    tg.run_tests()
