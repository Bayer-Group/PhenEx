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
        # Preserve section structure for serialization (None if cohort uses a flat list)
        self.characteristic_sections = getattr(cohort, "characteristic_sections", None)
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
            self.df["Pct"] = 100 * self.df["N"] / self.N
            # reorder columns so N and Pct are first
            first_cols = ["N", "Pct"]
            column_order = first_cols + [
                x for x in self.df.columns if x not in first_cols
            ]
            self.df = self.df[column_order]
        logger.debug("Finished creating table1")

        self.df = self.df.reset_index()
        self.df.columns = ["Name"] + list(self.df.columns[1:])

        self.df = self.df.sort_values(by=["inex_order", "Name"])
        self.df = self.df.reset_index()[
            [x for x in self.df.columns if x not in ["index", "inex_order"]]
        ]
        # Strip the "NNNN_" sort-order prefix that BinPhenotype embeds in bin
        # labels (e.g. "Age group=0003_[30-40)" → "Age group=[30-40)").
        self.df["Name"] = self.df["Name"].str.replace(
            r"=\d{4}_", "=", regex=True
        )
        return self.df

    def _get_boolean_characteristics(self):
        return [
            x for x in self.cohort.characteristics if x.output_display_type == "boolean"
        ]

    def _get_value_characteristics(self):
        return [
            x for x in self.cohort.characteristics if x.output_display_type == "value"
        ]

    def _get_categorical_characteristics(self):
        return [
            x
            for x in self.cohort.characteristics
            if x.output_display_type == "categorical"
        ]

    def _get_boolean_count_for_phenotype(self, phenotype):
        result = (
            phenotype.table.select(["PERSON_ID", "BOOLEAN"])
            .distinct()["BOOLEAN"]
            .sum()
            .execute()
        )
        # Return 0 if result is None or NaN (no rows with BOOLEAN=True)
        return (
            0
            if result is None or (isinstance(result, float) and pd.isna(result))
            else int(result)
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
        df_t1.index = [x.display_name for x in boolean_phenotypes]
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
                "Min": _table["VALUE"].min().execute(),
                "P10": _table["VALUE"].quantile(0.10).execute(),
                "P25": _table["VALUE"].quantile(0.25).execute(),
                "Median": _table["VALUE"].median().execute(),
                "P75": _table["VALUE"].quantile(0.75).execute(),
                "P90": _table["VALUE"].quantile(0.90).execute(),
                "Max": _table["VALUE"].max().execute(),
                "inex_order": self.cohort_names_in_order.index(phenotype.name),
            }
            dfs.append(pd.DataFrame.from_dict([d]))
            names.append(phenotype.display_name)
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
            name = phenotype.display_name
            _table = phenotype.table.select(["PERSON_ID", "VALUE"])
            # Get counts for each category.
            # Keep the raw VALUE (which may carry a "NNNN_" sort prefix from
            # BinPhenotype) in the index so that the final sort_values("Name")
            # in execute() orders bins correctly. The prefix is stripped there.
            cat_counts = (
                _table.distinct().group_by("VALUE").aggregate(N=_.count()).execute()
            )
            cat_counts.index = [
                f"{name}={v if v is not None else 'None'}" for v in cat_counts["VALUE"]
            ]
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

    def get_pretty_display(self) -> pd.DataFrame:
        """
        Return a formatted version of the Table1 results for display.

        Formats numeric columns and converts counts to strings to avoid NaN display.

        Returns:
            pd.DataFrame: Formatted copy of the results
        """
        # Create a copy to avoid modifying the original
        pretty_df = self.df.copy()

        # cast counts to integer and to str, so that we can display without 'NaNs'
        pretty_df["N"] = pretty_df["N"].astype("Int64").astype(str)

        pretty_df = pretty_df.round(self.decimal_places)

        to_prettify = [
            "Pct",
            "Mean",
            "STD",
            "Min",
            "P10",
            "P25",
            "Median",
            "P75",
            "P90",
            "Max",
        ]
        for column in to_prettify:
            if column in pretty_df.columns:
                pretty_df[column] = pretty_df[column].astype(str)

        pretty_df = pretty_df.replace("<NA>", "").replace("nan", "")

        return pretty_df

    def to_json(self, filename: str) -> str:
        """Export Table1 to JSON, including section metadata when available."""
        import json
        from pathlib import Path

        if not hasattr(self, "df"):
            raise AttributeError(
                "Call execute() first before calling to_json()."
            )

        filepath = Path(filename)
        if filepath.suffix != ".json":
            filepath = filepath.with_suffix(".json")
        filepath.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "reporter_type": self.__class__.__name__,
            "rows": self.df.to_dict(orient="records"),
        }
        if self.characteristic_sections:
            payload["sections"] = self.characteristic_sections

        with filepath.open("w") as f:
            json.dump(payload, f, indent=2, default=str)

        return str(filepath.absolute())
