import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_logic_phenotype_complex_entry import (
    LogicPhenotypeComplexEntryTestGenerator,
)


class MultiIndexLogicPhenotypeComplexEntryTestGenerator(
    MultiIndexMixin, LogicPhenotypeComplexEntryTestGenerator
):
    name_space = "mi_lgpt_complex_entry"
    _index_date = datetime.date(2022, 9, 20)

    def define_input_tables(self):
        tables = LogicPhenotypeComplexEntryTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = LogicPhenotypeComplexEntryTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_logic_phenotype_complex_entry():
    tg = MultiIndexLogicPhenotypeComplexEntryTestGenerator()
    tg.run_tests()
