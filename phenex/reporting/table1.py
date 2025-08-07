import pandas as pd

from phenex.reporting.reporter import Reporter
from phenex.util import create_logger
from ibis import _

logger = create_logger(__name__)


class Table1(Reporter):
    """
    Table1 is a common term used in epidemiology to describe a table that shows an overview of the baseline characteristics of a cohort. It contains the counts and percentages of the cohort that have each characteristic, for both boolean and value characteristics. In addition, summary statistics are provided for value characteristics (mean, std, median, min, max).

    """

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        if len(cohort.characteristics) == 0:
            logger.info("No characteristics. table1 is empty")
            return pd.DataFrame()

        self.cohort = cohort
        self.cohort_names_in_order = [x.name for x in self.cohort.characteristics]
        self.N = (
            cohort.index_table.filter(cohort.index_table.BOOLEAN == True)
            .select("PERSON_ID")
            .distinct()
            .count()
            .execute()
        )
        logger.debug("Starting with categorical columns for table1")
        self.df_categoricals = self._report_categorical_columns()
        logger.debug("Starting with boolean columns for table1")
        self.df_booleans = self._report_boolean_columns()
        logger.debug("Starting with value columns for table1")
        self.df_values = self._report_value_columns()

        # add the full cohort size as the first row
        df_n = pd.DataFrame({"N": [self.N], "inex_order": [-1]}, index=["Cohort"])
        # add percentage column
        dfs = [
            df
            for df in [df_n, self.df_booleans, self.df_values, self.df_categoricals]
            if df is not None
        ]
        if len(dfs) > 1:
            self.df = pd.concat(dfs)
        elif len(dfs) == 1:
            self.df = dfs[0]
        else:
            self.df = None
        if self.df is not None:
            self.df["%"] = 100 * self.df["N"] / self.N
            # reorder columns so N and % are first
            first_cols = ["N", "%"]
            column_order = first_cols + [
                x for x in self.df.columns if x not in first_cols
            ]
            self.df = self.df[column_order]
        logger.debug("Finished creating table1")

        if self.pretty_display:
            self.create_pretty_display()

        self.df = self.df.sort_values(by=["inex_order", "Name"])
        self.df = self.df.reset_index()[
            [x for x in self.df.columns if x not in ["index", "inex_order"]]
        ]
        return self.df

    def _get_boolean_characteristics(self):
        return [
            x
            for x in self.cohort.characteristics
            if type(x).__name__
            not in [
                "MeasurementPhenotype",
                "AgePhenotype",
                "TimeRangePhenotype",
                "ScorePhenotype",
                "CategoricalPhenotype",
                "SexPhenotype",
                "ArithmeticPhenotype",
                "EventCountPhenotype",
                "BinPhenotype",
            ]
        ]

    def _get_value_characteristics(self):
        return [
            x
            for x in self.cohort.characteristics
            if type(x).__name__
            in [
                "MeasurementPhenotype",
                "AgePhenotype",
                "TimeRangePhenotype",
                "ArithmeticPhenotype",
                "EventCountPhenotype",  # event count is a value; show summary statistics for number of days
            ]
        ]

    def _get_categorical_characteristics(self):
        return [
            x
            for x in self.cohort.characteristics
            if type(x).__name__
            in [
                "CategoricalPhenotype",
                "SexPhenotype",
                "ScorePhenotype",  # score is categorical; show number of patients in each score category
                "BinPhenotype",
            ]
        ]

    def _get_boolean_count_for_phenotype(self, phenotype):
        return (
            phenotype.table.select(["PERSON_ID", "BOOLEAN"])
            .distinct()["BOOLEAN"]
            .sum()
            .execute()
        )

    def _report_boolean_columns(self):
        table = self.cohort.characteristics_table
        # get list of all boolean columns
        boolean_phenotypes = self._get_boolean_characteristics()
        logger.debug(
            f"Found {len(boolean_phenotypes)} : {[x.name for x in boolean_phenotypes]}"
        )
        if len(boolean_phenotypes) == 0:
            return None
        # get count of 'Trues' in the boolean columns i.e. the phenotype counts
        df_t1 = pd.DataFrame()
        df_t1["N"] = [
            self._get_boolean_count_for_phenotype(phenotype)
            for phenotype in boolean_phenotypes
        ]
        df_t1.index = [
            x.display_name if self.pretty_display else x.name
            for x in boolean_phenotypes
        ]
        df_t1["inex_order"] = [
            self.cohort_names_in_order.index(x.name) for x in boolean_phenotypes
        ]
        return df_t1

    def _report_value_columns(self):
        value_phenotypes = self._get_value_characteristics()
        logger.debug(
            f"Found {len(value_phenotypes)} : {[x.name for x in value_phenotypes]}"
        )

        if len(value_phenotypes) == 0:
            return None

        names = []
        dfs = []
        for phenotype in value_phenotypes:
            _table = phenotype.table.select(["PERSON_ID", "VALUE"]).distinct()
            d = {
                "N": self._get_boolean_count_for_phenotype(phenotype),
                "Mean": _table["VALUE"].mean().execute(),
                "STD": _table["VALUE"].std().execute(),
                "Median": _table["VALUE"].median().execute(),
                "Min": _table["VALUE"].min().execute(),
                "Max": _table["VALUE"].max().execute(),
                "inex_order": self.cohort_names_in_order.index(phenotype.name),
            }
            dfs.append(pd.DataFrame.from_dict([d]))
            names.append(
                phenotype.display_name if self.pretty_display else phenotype.name
            )
        if len(dfs) == 1:
            df = dfs[0]
        else:
            df = pd.concat(dfs)
        df.index = names
        return df

    def _report_categorical_columns(self):
        categorical_phenotypes = self._get_categorical_characteristics()
        logger.debug(
            f"Found {len(categorical_phenotypes)} : {[x.name for x in categorical_phenotypes]}"
        )
        if len(categorical_phenotypes) == 0:
            return None
        dfs = []
        names = []
        for phenotype in categorical_phenotypes:
            name = phenotype.display_name if self.pretty_display else phenotype.name
            _table = phenotype.table.select(["PERSON_ID", "VALUE"])
            # Get counts for each category
            cat_counts = (
                _table.distinct().group_by("VALUE").aggregate(N=_.count()).execute()
            )
            cat_counts.index = [f"{name}={v}" for v in cat_counts["VALUE"]]
            _df = pd.DataFrame(cat_counts["N"])
            _df["inex_order"] = self.cohort_names_in_order.index(phenotype.name)
            dfs.append(_df)
            names.extend(cat_counts.index)
        if len(dfs) == 1:
            df = dfs[0]
        else:
            df = pd.concat(dfs)
        df.index = names
        return df

    def create_pretty_display(self):
        # cast counts to integer and to str, so that we can display without 'NaNs'
        self.df["N"] = self.df["N"].astype("Int64").astype(str)
        self.df = self.df.reset_index()
        self.df.columns = ["Name"] + list(self.df.columns[1:])

        self.df = self.df.round(self.decimal_places)

        to_prettify = ["%", "Mean", "STD", "Median", "Min", "Max"]
        for column in to_prettify:
            self.df[column] = self.df[column].astype(str)

        self.df = self.df.replace("<NA>", "").replace("nan", "")
