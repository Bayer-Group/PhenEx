from typing import List
import pandas as pd
from .reporter import Reporter


class InExCounts(Reporter):
    """
    Get counts of inclusion and exclusion criteria

    """

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        self.cohort = cohort
        self.df_counts_inclusion = self.get_counts_for_phenotypes(
            self.cohort.inclusions, "inclusion"
        )
        self.df_counts_exclusion = self.get_counts_for_phenotypes(
            self.cohort.exclusions, "exclusion"
        )
        return pd.concat([self.df_counts_inclusion, self.df_counts_exclusion])

    def get_counts_for_phenotypes(
        self, phenotypes: List["Phenotype"], category: str = None
    ):
        ds = []
        for pt in phenotypes:
            d = {
                "phenotype": pt.name,
                "n": pt.table.select("PERSON_ID").distinct().count().to_pandas(),
            }
            ds.append(d)
        _df = pd.DataFrame.from_records(ds)
        if category is not None:
            _df["category"] = category
        return _df
