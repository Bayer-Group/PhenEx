import pandas as pd

from .reporter import Reporter
from phenex.util import create_logger

logger = create_logger(__name__)


class Waterfall(Reporter):
    """
    A waterfall diagram, also known as an attrition table, shows how inclusion/exclusion criteria contribute to a final population size. Each inclusion/exclusion criteria is a row in the table, and the number of patients remaining after applying that criteria are shown on that row.

    | Column name | Description |
    | --- | --- |
    | Type | The type of the phenotype, either entry, inclusion or exclusion |
    | Name | The name of entry, inclusion or exclusion criteria |
    | N | The absolute number of patients that fulfill that phenotype. For the entry criterium this is the absolute number in the dataset. For inclusion/exclusion criteria this is the number of patients that fulfill the entry criterium AND the phenotype and that row. |
    | Remaining | The number of patients remaining in the cohort after sequentially applying the inclusion/exclusion criteria in the order that they are listed in this table. |
    | % | The percentage of patients who fulfill the entry criterion who are remaining in the cohort after application of the phenotype on that row |
    | Delta | The change in number of patients that occurs by applying the phenotype on that row. |

    """

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        self.cohort = cohort
        logger.debug(f"Beginning execution of waterfall. Calculating N patents")
        N = (
            cohort.index_table.filter(cohort.index_table.BOOLEAN == True)
            .select("PERSON_ID")
            .distinct()
            .count()
            .execute()
        )
        logger.debug(f"Cohort has {N} patients")
        self.ds = []

        table = cohort.entry_criterion.table
        N_entry = table.count().execute()
        self.ds.append(
            {
                "Type": "entry",
                "Name": (
                    cohort.entry_criterion.display_name
                    if self.pretty_display
                    else cohort.entry_criterion.name
                ),
                "N": N_entry,
                "Remaining": table.count().execute(),
            }
        )

        for inclusion in cohort.inclusions:
            table = self.append_phenotype_to_waterfall(table, inclusion, "inclusion")

        for exclusion in cohort.exclusions:
            table = self.append_phenotype_to_waterfall(table, exclusion, "exclusion")

        self.ds.append(
            {
                "Type": "final_cohort",
                "Name": "",
                "N": None,
                "Remaining": N,
            }
        )
        self.ds = self.append_delta(self.ds)

        # create dataframe with phenotype counts
        self.df = pd.DataFrame(self.ds)

        # calculate percentage of entry criterion
        self.df["%"] = self.df["Remaining"] / N_entry * 100
        self.df = self.df.round(self.decimal_places)

        if self.pretty_display:
            self.create_pretty_display()

        # Do final column selection
        self.df = self.df[["Type", "Name", "N", "Remaining", "%", "Delta"]]

        return self.df

    def append_phenotype_to_waterfall(self, table, phenotype, type):
        if type == "inclusion":
            table = table.inner_join(
                phenotype.table, table["PERSON_ID"] == phenotype.table["PERSON_ID"]
            )
        elif type == "exclusion":
            table = table.filter(~table["PERSON_ID"].isin(phenotype.table["PERSON_ID"]))
        else:
            raise ValueError("type must be either inclusion or exclusion")
        logger.debug(f"Starting {type} criteria {phenotype.name}")
        self.ds.append(
            {
                "Type": type,
                "Name": (
                    phenotype.display_name if self.pretty_display else phenotype.name
                ),
                "N": phenotype.table.select("PERSON_ID").distinct().count().execute(),
                "Remaining": table.select("PERSON_ID").distinct().count().execute(),
            }
        )
        logger.debug(
            f"Finished {type} criteria {phenotype.name}: N = {self.ds[-1]['N']} waterfall = {self.ds[-1]['Remaining']}"
        )
        return table.select("PERSON_ID")

    def append_delta(self, ds):
        ds[0]["Delta"] = None
        for i in range(1, len(ds) - 1):
            d_current = ds[i]
            d_previous = ds[i - 1]
            d_current["Delta"] = d_current["Remaining"] - d_previous["Remaining"]
        return ds

    def create_pretty_display(self):
        # cast counts to integer and to str, so that we can display without 'NaNs'
        self.df["N"] = self.df["N"].astype("Int64").astype(str)
        self.df["Delta"] = self.df["Delta"].astype("Int64").astype(str)

        # Replace NAs and None values with empty strings for display
        self.df = self.df.replace("<NA>", "")

        # create a sparse 'type' column name where inclusion/exclusion only appear once (instead of repeated on each row)
        previous_type = None
        sparse_types = []
        for _type in self.df["Type"].values:
            if _type != previous_type:
                sparse_types.append(_type)
                previous_type = _type
            else:
                sparse_types.append("")
        self.df["Type"] = sparse_types
