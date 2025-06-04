import pandas as pd

from phenex.reporting.reporter import Reporter
from phenex.util import create_logger
from ibis import _

logger = create_logger(__name__)


class Table1(Reporter):
    """
    Table1 is a common term used in epidemiology to describe a table that shows an overview of the baseline characteristics of a cohort. It contains the counts and percentages of the cohort that have each characteristic, for both boolean and value characteristics. In addition, summary statistics are provided for value characteristics (mean, std, median, min, max).


    ToDo:
        1. implement categorical value reporting
    """

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        self.cohort = cohort
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

        # add percentage column
        dfs = [
            df
            for df in [self.df_booleans, self.df_values, self.df_categoricals]
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
        return self.df

    def _get_boolean_characteristics(self):
        return [
            x
            for x in self.cohort.characteristics
            if type(x).__name__
            not in [
                "MeasurementPhenotype",
                "AgePhenotype",
                "CategoricalPhenotype",
                "SexPhenotype",
            ]
        ]

    def _get_value_characteristics(self):
        return [
            x
            for x in self.cohort.characteristics
            if type(x).__name__ in ["MeasurementPhenotype", "AgePhenotype"]
        ]

    def _get_categorical_characteristics(self):
        return [
            x
            for x in self.cohort.characteristics
            if type(x).__name__ in ["CategoricalPhenotype", "SexPhenotype"]
        ]

    def _report_boolean_columns(self):
        table = self.cohort.characteristics_table
        # get list of all boolean columns
        boolean_phenotypes = self._get_boolean_characteristics()
        boolean_columns = list(set([f"{x.name}_BOOLEAN" for x in boolean_phenotypes]))
        logger.debug(f"Found {len(boolean_columns)} : {boolean_columns}")
        if len(boolean_columns) == 0:
            return None

        def get_counts_for_column(col):
            return table.select(["PERSON_ID", col]).distinct()[col].sum().execute()

        # get count of 'Trues' in the boolean columns i.e. the phenotype counts
        df_t1 = pd.DataFrame()
        df_t1["N"] = [get_counts_for_column(col) for col in boolean_columns]
        df_t1.index = [x.replace("_BOOLEAN", "") for x in boolean_columns]

        # add the full cohort size as the first row
        df_n = pd.DataFrame({"N": [self.N]}, index=["cohort"])
        # concat population size
        df = pd.concat([df_n, df_t1])
        return df

    def _report_value_columns(self):
        table = self.cohort.characteristics_table
        # get value columns
        value_phenotypes = self._get_value_characteristics()
        value_columns = [f"{x.name}_VALUE" for x in value_phenotypes]
        logger.debug(f"Found {len(value_columns)} : {value_columns}")

        if len(value_columns) == 0:
            return None

        names = []
        dfs = []
        for col in value_columns:
            name = col.split("_VALUE")[0]
            _table = table.select(["PERSON_ID", col]).distinct()
            d = {
                "N": _table[col].count().execute(),
                "mean": _table[col].mean().execute(),
                "std": _table[col].std().execute(),
                "median": _table[col].median().execute(),
                "min": _table[col].min().execute(),
                "max": _table[col].max().execute(),
            }
            dfs.append(pd.DataFrame.from_dict([d]))
            names.append(name)
        if len(dfs) == 1:
            df = dfs[0]
        else:
            df = pd.concat(dfs)
        df.index = names
        return df

    def _report_categorical_columns(self):
        table = self.cohort.characteristics_table
        categorical_phenotypes = self._get_categorical_characteristics()
        categorical_columns = [
            f"{x.name}_VALUE"
            for x in categorical_phenotypes
            if f"{x.name}_VALUE" in table.columns
        ]
        logger.debug(f"Found {len(categorical_columns)} : {categorical_columns}")
        if len(categorical_columns) == 0:
            return None
        dfs = []
        names = []
        for col in categorical_columns:
            name = col.replace("_VALUE", "")
            # Get counts for each category
            cat_counts = (
                table.select(["PERSON_ID", col])
                .distinct()
                .group_by(col)
                .aggregate(N=_.count())
                .execute()
            )
            cat_counts.index = [f"{name}={v}" for v in cat_counts[col]]
            dfs.append(cat_counts["N"])
            names.extend(cat_counts.index)
        if len(dfs) == 1:
            df = dfs[0]
        else:
            df = pd.concat(dfs)
        df.index = names
        return df
