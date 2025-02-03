import pandas as pd

from .reporter import Reporter


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

        self.df_booleans = self._report_boolean_columns()
        self.df_values = self._report_value_columns()

        # add percentage column
        if self.df_booleans is not None and self.df_values is not None:
            self.df = pd.concat([self.df_booleans, self.df_values])
        else:
            self.df = self.df_booleans or self.df_values
        self.df["%"] = 100 * self.df["N"] / self.N

        # reorder columns so N and % are first
        first_cols = ["N", "%"]
        column_order = first_cols + [x for x in self.df.columns if x not in first_cols]
        self.df = self.df[column_order]
        return self.df

    def _phenotype_column_is_of_value_type(self, name_column):
        """
        Return
        """
        if "_VALUE" in name_column:
            value_col = name_column
        elif "_BOOLEAN" in name_column:
            value_col = name_column.replace("_BOOLEAN", "_VALUE")
        else:
            value_col = f"{name_column}_VALUE"
        column_dtype = self.cohort.characteristics_table[value_col].type()
        if column_dtype.is_integer() or column_dtype.is_floating():
            return True
        return False

    def _report_boolean_columns(self):
        table = self.cohort.characteristics_table
        # get list of all phenotype boolean columns
        boolean_columns = [col for col in table.columns if col.endswith("_BOOLEAN")]
        # remove value columns (these are reported in the value section)
        boolean_columns = [
            x for x in boolean_columns if not self._phenotype_column_is_of_value_type(x)
        ]
        if len(boolean_columns) == 0:
            return None

        # get count of 'Trues' in the boolean columns i.e. the phenotype counts
        true_counts = [
            table[col].sum().name(col.split("_BOOLEAN")[0]) for col in boolean_columns
        ]
        # perform actual sum operations and convert to pandas
        result_table = table.aggregate(true_counts).to_pandas()
        # transpose to create proper table format (each row should be a phenotype)
        df_t1 = result_table.T
        # name count column 'N'
        df_t1.columns = ["N"]
        # add the full cohort size as the first row
        df_n = pd.DataFrame({"N": [self.N]}, index=["cohort"])
        # concat population size
        df = pd.concat([df_n, df_t1])
        return df

    def _report_value_columns(self):
        table = self.cohort.characteristics_table
        # Assuming 'table' is your Ibis table and 'value_columns' is already defined
        value_columns = [col for col in table.columns if col.endswith("_VALUE")]
        value_columns = [
            x for x in value_columns if self._phenotype_column_is_of_value_type(x)
        ]

        if len(value_columns) == 0:
            return None

        names = []
        dfs = []
        for col in value_columns:
            name = col.split("_VALUE")[0]
            d = {
                "N": table[col].count().execute(),
                "mean": table[col].mean().execute(),
                "std": table[col].std().execute(),
                "median": table[col].median().execute(),
                "min": table[col].min().execute(),
                "max": table[col].max().execute(),
            }
            dfs.append(pd.DataFrame.from_dict([d]))
            names.append(name)
        if len(dfs) == 1:
            df = dfs[0]
        else:
            df = pd.concat(dfs)
        df.index = names
        return df
