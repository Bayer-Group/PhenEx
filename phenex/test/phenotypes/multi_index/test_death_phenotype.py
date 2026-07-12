import datetime

import pandas as pd

from phenex.test.phenotypes.multi_index_mixin import MultiIndexMixin
from phenex.test.phenotypes.test_death_phenotype import (
    DeathPhenotypeTestGenerator,
    DeathPhenotypeDateRangeTestGenerator,
    DeathPhenotypeMonthOfDeathOnlyTestGenerator,
    DeathPhenotypeBothDateColumnsTestGenerator,
)


class MultiIndexDeathPhenotypeTestGenerator(
    MultiIndexMixin, DeathPhenotypeTestGenerator
):
    name_space = "mi_dthpt"
    _index_date = datetime.date(2022, 1, 1)
    _shift = datetime.timedelta(days=730)

    def _duplicate_input_tables(self, input_tables):
        """Shift INDEX_DATE backward instead of forward for death phenotype."""
        result = []
        for info in input_tables:
            df = info["df"].copy()
            if "INDEX_DATE" not in df.columns:
                result.append(info)
                continue
            df2 = df.copy()
            df2["INDEX_DATE"] = pd.to_datetime(df2["INDEX_DATE"]) - self.shift
            combined = pd.concat([df, df2], ignore_index=True)
            result.append({**info, "df": combined})
        return result

    def define_input_tables(self):
        tables = DeathPhenotypeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = DeathPhenotypeTestGenerator.define_phenotype_tests(self)
        index_date_1 = self._index_date
        index_date_2 = datetime.date(
            *(pd.Timestamp(index_date_1) - self.shift).timetuple()[:3]
        )

        # Death dates (same for both INDEX_DATEs):
        # P0: None, P1: idx, P2: idx-20d, P3: idx-40d, P4: idx-60d,
        # P5: idx+0d, P6: idx+20d, P7: idx+40d, P8: idx+60d
        # At index_date_2 (~2020-01-02) ALL deaths are >670 days in the future.
        # Only unbounded "after" filters match; all "before" and bounded filters
        # produce no matches at index_date_2.
        death_dates = list(self.input_table["DATE_OF_DEATH"].values)

        for info in tests:
            orig_persons = list(info["persons"])
            orig_dates = list(info["dates"])

            rtr = info.get("time_range_filter")
            shifted_persons = []
            shifted_dates = []

            if rtr is not None and rtr.when == "after":
                has_min_days = rtr.min_days is not None
                has_max_days = rtr.max_days is not None
                for i in range(self.n_persons):
                    dd = death_dates[i]
                    if dd is None or pd.isna(dd):
                        continue
                    dd_date = pd.Timestamp(dd)
                    idx2_ts = pd.Timestamp(index_date_2)
                    days_diff = (dd_date - idx2_ts).days
                    if days_diff < 0:
                        continue
                    if has_min_days:
                        op = rtr.min_days.operator
                        val = rtr.min_days.value
                        if op == ">" and days_diff <= val:
                            continue
                        if op == ">=" and days_diff < val:
                            continue
                    if has_max_days:
                        op = rtr.max_days.operator
                        val = rtr.max_days.value
                        if op == "<=" and days_diff > val:
                            continue
                        if op == "<" and days_diff >= val:
                            continue
                    shifted_persons.append(f"P{i}")
                    shifted_dates.append(dd)

            info["persons"] = orig_persons + shifted_persons
            info["dates"] = orig_dates + shifted_dates
            info["index_dates"] = [index_date_1] * len(orig_persons) + [
                index_date_2
            ] * len(shifted_persons)

        return tests


class MultiIndexDeathPhenotypeDateRangeTestGenerator(
    MultiIndexMixin, DeathPhenotypeDateRangeTestGenerator
):
    name_space = "mi_dthpt_daterange"
    _index_date = datetime.date(2022, 1, 1)
    _shift = datetime.timedelta(days=730)

    def _duplicate_input_tables(self, input_tables):
        """Shift INDEX_DATE backward instead of forward for death phenotype."""
        result = []
        for info in input_tables:
            df = info["df"].copy()
            if "INDEX_DATE" not in df.columns:
                result.append(info)
                continue
            df2 = df.copy()
            df2["INDEX_DATE"] = pd.to_datetime(df2["INDEX_DATE"]) - self.shift
            combined = pd.concat([df, df2], ignore_index=True)
            result.append({**info, "df": combined})
        return result

    def define_input_tables(self):
        tables = DeathPhenotypeDateRangeTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = DeathPhenotypeDateRangeTestGenerator.define_phenotype_tests(self)
        index_date_1 = self._index_date
        index_date_2 = datetime.date(
            *(pd.Timestamp(index_date_1) - self.shift).timetuple()[:3]
        )
        death_dates = list(self.input_table["DATE_OF_DEATH"].values)

        # At index_date_2 (~2020-01-02) all deaths are far in the future.
        # date_range is absolute (2021-12-01..2022-01-31) so it still applies.
        # "after" filter: deaths in date_range AND after index_date_2 → P1,P2,P3
        # "before" filter: no deaths are before index_date_2 → none
        for info in tests:
            orig_persons = list(info["persons"])
            orig_dates = list(info["dates"])
            orig_values = list(info["values"])

            phenotype = info["phenotype"]
            rtr = phenotype.relative_time_range
            if isinstance(rtr, list):
                rtr = rtr[0]

            shifted_persons = []
            shifted_dates = []
            shifted_values = []

            if rtr.when == "after":
                # Deaths in date_range AND after index_date_2
                dt_start = pd.Timestamp("2021-12-01")
                dt_end = pd.Timestamp("2022-01-31")
                idx2_ts = pd.Timestamp(index_date_2)
                for i in range(len(death_dates)):
                    dd = death_dates[i]
                    if dd is None or pd.isna(dd):
                        continue
                    dd_ts = pd.Timestamp(dd)
                    if dd_ts >= dt_start and dd_ts <= dt_end and dd_ts >= idx2_ts:
                        days_diff = (dd_ts - idx2_ts).days
                        shifted_persons.append(f"P{i}")
                        shifted_dates.append(dd)
                        shifted_values.append(days_diff)

            info["persons"] = orig_persons + shifted_persons
            info["dates"] = orig_dates + shifted_dates
            info["values"] = orig_values + shifted_values
            info["index_dates"] = [index_date_1] * len(orig_persons) + [
                index_date_2
            ] * len(shifted_persons)

        return tests


def test_multiindex_death_phenotype():
    tg = MultiIndexDeathPhenotypeTestGenerator()
    tg.run_tests()


def test_multiindex_death_phenotype_date_range():
    tg = MultiIndexDeathPhenotypeDateRangeTestGenerator()
    tg.run_tests()


class MultiIndexDeathPhenotypeMonthOnlyTestGenerator(
    MultiIndexMixin, DeathPhenotypeMonthOfDeathOnlyTestGenerator
):
    """Multi-index variant of the MONTH_OF_DEATH-only test.

    INDEX_DATE is shifted *backward* by 730 days so that all month-derived
    death dates (2021-12 through 2022-03) lie in the future relative to
    index_date_2 (~2020-01-03).
    """

    name_space = "mi_dtpt_month_only"
    _index_date = datetime.date(2022, 1, 1)
    _shift = datetime.timedelta(days=730)

    def _duplicate_input_tables(self, input_tables):
        result = []
        for info in input_tables:
            df = info["df"].copy()
            df2 = df.copy()
            df2["INDEX_DATE"] = pd.to_datetime(df2["INDEX_DATE"]) - self.shift
            combined = pd.concat([df, df2], ignore_index=True)
            result.append({**info, "df": combined})
        return result

    def define_input_tables(self):
        tables = DeathPhenotypeMonthOfDeathOnlyTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = DeathPhenotypeMonthOfDeathOnlyTestGenerator.define_phenotype_tests(self)
        index_date_1 = self._index_date
        index_date_2 = datetime.date(
            *(pd.Timestamp(index_date_1) - self.shift).timetuple()[:3]
        )
        idx2_ts = pd.Timestamp(index_date_2)

        # Death dates derived from MONTH_OF_DEATH:
        # P0: None, P1: 2021-12-15, P2: 2022-01-15, P3: 2022-03-15
        # At index_date_2 (~2020-01-03) all deaths are in the future.
        death_dates = {
            "P1": datetime.date(2021, 12, 15),
            "P2": datetime.date(2022, 1, 15),
            "P3": datetime.date(2022, 3, 15),
        }

        for info in tests:
            orig_persons = list(info["persons"])
            orig_dates = list(info["dates"])
            phenotype = info["phenotype"]
            rtr = phenotype.relative_time_range
            if isinstance(rtr, list):
                rtr = rtr[0] if rtr else None

            shifted_persons = []
            shifted_dates = []

            if rtr is None:
                # No filter: all dead persons appear at both index dates.
                shifted_persons = list(orig_persons)
                shifted_dates = list(orig_dates)
            elif rtr.when == "after":
                # At index_date_2 all deaths are in the future → all included.
                for pid, dd in death_dates.items():
                    if pd.Timestamp(dd) >= idx2_ts:
                        shifted_persons.append(pid)
                        shifted_dates.append(dd)
            # "before": at index_date_2 no deaths precede it → shifted lists stay empty.

            info["persons"] = orig_persons + shifted_persons
            info["dates"] = orig_dates + shifted_dates
            info["index_dates"] = [index_date_1] * len(orig_persons) + [
                index_date_2
            ] * len(shifted_persons)

        return tests


class MultiIndexDeathPhenotypeBothDateColumnsTestGenerator(
    MultiIndexMixin, DeathPhenotypeBothDateColumnsTestGenerator
):
    """Multi-index variant of the combined DATE_OF_DEATH / MONTH_OF_DEATH test.

    Same backward-shift strategy: at index_date_2 (~2020-01-03) all deaths
    are in the future, so "before" produces no rows at that index date.
    """

    name_space = "mi_dtpt_both_date"
    _index_date = datetime.date(2022, 1, 1)
    _shift = datetime.timedelta(days=730)

    def _duplicate_input_tables(self, input_tables):
        result = []
        for info in input_tables:
            df = info["df"].copy()
            df2 = df.copy()
            df2["INDEX_DATE"] = pd.to_datetime(df2["INDEX_DATE"]) - self.shift
            combined = pd.concat([df, df2], ignore_index=True)
            result.append({**info, "df": combined})
        return result

    def define_input_tables(self):
        tables = DeathPhenotypeBothDateColumnsTestGenerator.define_input_tables(self)
        return self._duplicate_input_tables(tables)

    def define_phenotype_tests(self):
        tests = DeathPhenotypeBothDateColumnsTestGenerator.define_phenotype_tests(self)
        index_date_1 = self._index_date
        index_date_2 = datetime.date(
            *(pd.Timestamp(index_date_1) - self.shift).timetuple()[:3]
        )
        idx2_ts = pd.Timestamp(index_date_2)

        # Resolved death dates (after coalesce logic):
        # P0: 2022-01-10 (exact), P1: 2021-12-15 (from month), P2: 2022-03-20 (exact)
        death_dates = {
            "P0": datetime.date(2022, 1, 10),
            "P1": datetime.date(2021, 12, 15),
            "P2": datetime.date(2022, 3, 20),
        }

        for info in tests:
            orig_persons = list(info["persons"])
            orig_dates = list(info["dates"])
            phenotype = info["phenotype"]
            rtr = phenotype.relative_time_range
            if isinstance(rtr, list):
                rtr = rtr[0] if rtr else None

            shifted_persons = []
            shifted_dates = []

            if rtr is None:
                # No filter: all dead persons appear at both index dates.
                shifted_persons = list(orig_persons)
                shifted_dates = list(orig_dates)
            elif rtr.when == "after":
                for pid, dd in death_dates.items():
                    if pd.Timestamp(dd) >= idx2_ts:
                        shifted_persons.append(pid)
                        shifted_dates.append(dd)
            # "before": at index_date_2 no deaths precede it → empty.

            info["persons"] = orig_persons + shifted_persons
            info["dates"] = orig_dates + shifted_dates
            info["index_dates"] = [index_date_1] * len(orig_persons) + [
                index_date_2
            ] * len(shifted_persons)

        return tests


# def test_multiindex_death_phenotype_month_only():
#     tg = MultiIndexDeathPhenotypeMonthOnlyTestGenerator()
#     tg.run_tests()


def test_multiindex_death_phenotype_both_date_columns():
    tg = MultiIndexDeathPhenotypeBothDateColumnsTestGenerator()
    tg.run_tests()
