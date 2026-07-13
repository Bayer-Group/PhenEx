import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_logic_phenotype import (
    LogicPhenotypeValueTestGenerator,
    LogicPhenotypeMixedComponentValueTypesTestGenerator,
)


class MultiIndexLogicPhenotypeValueTestGenerator(
    MultiIndexMixin, LogicPhenotypeValueTestGenerator
):
    name_space = "mi_lgpt_value"
    _index_date = datetime.date(2020, 1, 1)

    def define_input_tables(self):
        tables = LogicPhenotypeValueTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = LogicPhenotypeValueTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


class MultiIndexLogicPhenotypeMixedComponentValueTypesTestGenerator(
    MultiIndexMixin, LogicPhenotypeMixedComponentValueTypesTestGenerator
):
    name_space = "mi_lgpt_mixed"
    _index_date = datetime.date(2020, 1, 1)

    def define_input_tables(self):
        tables = (
            LogicPhenotypeMixedComponentValueTypesTestGenerator.define_input_tables(
                self
            )
        )
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = (
            LogicPhenotypeMixedComponentValueTypesTestGenerator.define_phenotype_tests(
                self
            )
        )
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_logic_phenotype_value():
    tg = MultiIndexLogicPhenotypeValueTestGenerator()
    tg.run_tests()


def test_multiindex_logic_phenotype_mixed_value_types():
    tg = MultiIndexLogicPhenotypeMixedComponentValueTypesTestGenerator()
    tg.run_tests()
