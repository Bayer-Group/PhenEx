import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_bin_phenotype import BinnedAgePhenotypeTestGenerator


class MultiIndexBinnedAgePhenotypeTestGenerator(
    MultiIndexMixin, BinnedAgePhenotypeTestGenerator
):
    name_space = "mi_bnpt"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = BinnedAgePhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = BinnedAgePhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_binned_age_phenotype():
    tg = MultiIndexBinnedAgePhenotypeTestGenerator()
    tg.run_tests()
