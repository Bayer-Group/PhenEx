import datetime

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_age_phenotype import AgePhenotypeTestGenerator


class MultiIndexAgePhenotypeTestGenerator(MultiIndexMixin, AgePhenotypeTestGenerator):
    name_space = "mi_agpt"
    _index_date = datetime.date(2022, 1, 1)
    _shift = datetime.timedelta(days=730)

    def define_input_tables(self):
        tables = AgePhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = AgePhenotypeTestGenerator.define_phenotype_tests(self)
        age_shift = self.shift.days // 365
        index_date_2 = self._index_date + self.shift

        for info in tests:
            orig_persons = list(info["persons"])
            orig_values = list(info["values"])

            # At index_date_2, person P{x} has age x + age_shift.
            # Recompute which persons pass the value filter at the shifted age.
            shifted_persons = []
            shifted_values = []
            for x in range(self.n_persons):
                age = x + age_shift
                if self._check_filter(info.get("value_filter"), age):
                    shifted_persons.append(f"P{x}")
                    shifted_values.append(age)

            info["persons"] = orig_persons + shifted_persons
            info["values"] = orig_values + shifted_values
            info["index_dates"] = [self._index_date] * len(orig_persons) + [
                index_date_2
            ] * len(shifted_persons)

        return tests

    @staticmethod
    def _check_filter(vf, age):
        if vf is None:
            return True
        if vf.min_value is not None:
            op = vf.min_value.operator
            val = vf.min_value.value
            if op == ">=" and age < val:
                return False
            if op == ">" and age <= val:
                return False
        if vf.max_value is not None:
            op = vf.max_value.operator
            val = vf.max_value.value
            if op == "<=" and age > val:
                return False
            if op == "<" and age >= val:
                return False
        return True


def test_multiindex_age_phenotype():
    tg = MultiIndexAgePhenotypeTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_multiindex_age_phenotype()
