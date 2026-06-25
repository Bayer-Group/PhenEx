import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_categoric_phenotype import (
    CategoricalPhenotypeWithDateTestGenerator,
)


class MultiIndexCategoricalPhenotypeWithDateTestGenerator(
    MultiIndexMixin, CategoricalPhenotypeWithDateTestGenerator
):
    name_space = "mi_ctpt_date"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = CategoricalPhenotypeWithDateTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = CategoricalPhenotypeWithDateTestGenerator.define_phenotype_tests(self)
        idx1 = self._index_date
        idx2 = self._index_date + self.shift

        # With 90-day shift (→ 2022-04-01), P3's event (2022-01-03) is now
        # before the shifted index, so it passes "before" filters.
        # For "after" filter (c3), P3's event is now before shifted → excluded.
        shifted_persons = {
            "single_flag": ["P0", "P1", "P2", "P3"],
            "two_categorical_filter_or": ["P0", "P1", "P2", "P3", "P6", "P7"],
            "two_categorical_filter_and": [],
        }

        for test in tests:
            orig = list(test["persons"])
            shifted = shifted_persons[test["name"]]
            test["persons"] = orig + shifted
            test["index_dates"] = [idx1] * len(orig) + [idx2] * len(shifted)

        return tests


def test_multiindex_categorical_phenotype_with_date():
    tg = MultiIndexCategoricalPhenotypeWithDateTestGenerator()
    tg.run_tests()
