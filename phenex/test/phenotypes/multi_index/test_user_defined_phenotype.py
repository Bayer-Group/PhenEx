import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_user_defined_phenotype import (
    UserDefinedPhenotypeTestGenerator,
)


class MultiIndexUserDefinedPhenotypeTestGenerator(
    MultiIndexMixin, UserDefinedPhenotypeTestGenerator
):
    name_space = "mi_udpt"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = UserDefinedPhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = UserDefinedPhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_user_defined_phenotype():
    tg = MultiIndexUserDefinedPhenotypeTestGenerator()
    tg.run_tests()
