import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_arithmetic_phenotype import (
    ArithmeticPhenotypeArithmeticPhenotypeTestGenerator,
)


class MultiIndexArithmeticPhenotypeTestGenerator(
    MultiIndexMixin, ArithmeticPhenotypeArithmeticPhenotypeTestGenerator
):
    name_space = "mi_arpt"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = ArithmeticPhenotypeArithmeticPhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = ArithmeticPhenotypeArithmeticPhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_arithmetic_phenotype():
    tg = MultiIndexArithmeticPhenotypeTestGenerator()
    tg.run_tests()
