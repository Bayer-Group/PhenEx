import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_event_count_phenotype import EventCountTestGenerator


class MultiIndexEventCountTestGenerator(MultiIndexMixin, EventCountTestGenerator):
    name_space = "mi_ecpt"
    _index_date = datetime.date(2022, 1, 1)

    def define_input_tables(self):
        tables = EventCountTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = EventCountTestGenerator.define_phenotype_tests(self)
        return self._duplicate_expected(tests, self._index_date)


def test_multiindex_event_count():
    tg = MultiIndexEventCountTestGenerator()
    tg.run_tests()
