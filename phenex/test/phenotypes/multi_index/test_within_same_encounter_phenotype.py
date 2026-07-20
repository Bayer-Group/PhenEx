import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_within_same_encounter_phenotype import (
    WithinSameEncounterPhenotypeTestGenerator,
)


class MultiIndexWithinSameEncounterPhenotypeTestGenerator(
    MultiIndexMixin, WithinSameEncounterPhenotypeTestGenerator
):
    name_space = "mi_wsept"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = WithinSameEncounterPhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = WithinSameEncounterPhenotypeTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_within_same_encounter_phenotype():
    tg = MultiIndexWithinSameEncounterPhenotypeTestGenerator()
    tg.run_tests()
