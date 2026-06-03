import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_codelist_phenotype_autojoin import (
    CodelistPhenotypeAutojoinTimeRangeTestGenerator,
)


class MultiIndexCodelistAutojoinTimeRangeTestGenerator(
    MultiIndexMixin, CodelistPhenotypeAutojoinTimeRangeTestGenerator
):
    name_space = "mi_clpt_autojoin_timerange"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = CodelistPhenotypeAutojoinTimeRangeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = CodelistPhenotypeAutojoinTimeRangeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_codelist_autojoin_time_range():
    tg = MultiIndexCodelistAutojoinTimeRangeTestGenerator()
    tg.run_tests()
