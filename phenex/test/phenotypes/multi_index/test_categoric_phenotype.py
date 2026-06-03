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
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_categorical_phenotype_with_date():
    tg = MultiIndexCategoricalPhenotypeWithDateTestGenerator()
    tg.run_tests()
