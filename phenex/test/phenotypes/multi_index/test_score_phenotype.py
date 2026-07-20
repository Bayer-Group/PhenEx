import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_score_phenotype import ScorePhenotypeTestGenerator


class MultiIndexScorePhenotypeTestGenerator(
    MultiIndexMixin, ScorePhenotypeTestGenerator
):
    name_space = "mi_scpt"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = ScorePhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = ScorePhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_score_phenotype():
    tg = MultiIndexScorePhenotypeTestGenerator()
    tg.run_tests()
