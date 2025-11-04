import pandas as pd
import numpy as np

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
    

    def _append_components_recursively(self, current_phenotype, table, level=0, parent_index=""):
        if level <= self.include_component_phenotypes_level:
            for i, child in enumerate(current_phenotype.children):
                current_index = f"{parent_index}.{i+1}"
                current_name = child.display_name if self.pretty_display else child.name
                self.append_phenotype_to_waterfall(table, child, "component", full_name=current_name, index=current_index, level=level)
                self._append_components_recursively(child, table, level + 1, parent_index=current_index)

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
        index = 1
        self.ds.append(
            {
                "Type": "entry",
                "Index":str(index),
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
            index += 1
            table = self.append_phenotype_to_waterfall(table, inclusion, "inclusion", level = index)
            if self.include_component_phenotypes_level is not None:
                self._append_components_recursively(inclusion, table, parent_index = str(index))

                

        for exclusion in cohort.exclusions:
            index += 1
            table = self.append_phenotype_to_waterfall(table, exclusion, "exclusion", level = index)
            if self.include_component_phenotypes_level is not None:
                self._append_components_recursively(exclusion, table, parent_index = str(index))
                
        self.ds.append(
            {
                "Type": "final_cohort",
                "Name": "",
                "Component of":"",
                "N": np.nan,
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
        if self.include_component_phenotypes_level is None:
            self.df = self.df[["Type", "Name", "N", "Remaining", "%", "Delta"]]
        else:
            self.df = self.df[["Type", "Name","Index", "N", "Remaining", "%", "Delta"]]
        return self.df

    def append_phenotype_to_waterfall(self, table, phenotype, type, level, index= None, full_name = None):
        if type == "inclusion":
            table = table.inner_join(
                phenotype.table, table["PERSON_ID"] == phenotype.table["PERSON_ID"]
            )
        elif type == "exclusion":
            table = table.filter(~table["PERSON_ID"].isin(phenotype.table["PERSON_ID"]))
        elif type == 'component':
            table = table
        else:
            raise ValueError("type must be either inclusion or exclusion")
        logger.debug(f"Starting {type} criteria {phenotype.name}")

        if full_name is None:
            full_name = phenotype.display_name if self.pretty_display else phenotype.name
            
        self.ds.append(
            {
                "Type": type,
                "Name": full_name,
                "Level": level,
                "Index": index if index is not None else str(level),
                "N": phenotype.table.select("PERSON_ID").distinct().count().execute(),
                "Remaining": table.select("PERSON_ID").distinct().count().execute() if type != 'component' else np.nan,
            }
        )
        logger.debug(
            f"Finished {type} criteria {phenotype.name}: N = {self.ds[-1]['N']} waterfall = {self.ds[-1]['Remaining']}"
        )
        return table.select("PERSON_ID")

    def append_delta(self, ds):
        ds[0]["Delta"] = np.nan
        previous_remaining = ds[0]["Remaining"]
        for i in range(1, len(ds) - 1):
            d_current = ds[i]
            d_previous = ds[i - 1]
            if pd.isna(d_current["Remaining"]):
                d_current["Delta"] = np.nan
                continue
            print(f"Current: {d_current['Remaining']}, Previous: {previous_remaining}")
            d_current["Delta"] = d_current["Remaining"] - previous_remaining
            previous_remaining = d_current["Remaining"]
        return ds

    def create_pretty_display(self):
        # cast counts to integer and to str, so that we can display without 'NaNs'
        self.df["N"] = self.df["N"].astype("Int64").astype(str)
        self.df["Delta"] = self.df["Delta"].astype("Int64").astype(str)
        self.df["Remaining"] = self.df["Remaining"].astype("Int64").astype(str)
        self.df["%"] = self.df["%"].astype("Float64").astype(str)

        # Replace NAs and None values with empty strings for display
        self.df = self.df.replace("<NA>", "")

        # create a sparse 'type' column name where inclusion/exclusion only appear once (instead of repeated on each row)
        previous_type = None
        sparse_types = []
        for _type in self.df["Type"].values:
            if _type != previous_type and _type != 'component':
                sparse_types.append(_type)
                previous_type = _type
            else:
                sparse_types.append("")
        self.df["Type"] = sparse_types

