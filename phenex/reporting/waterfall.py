import pandas as pd

from .reporter import Reporter
from phenex.util import create_logger

logger = create_logger(__name__)

class Waterfall(Reporter):
    """
    A waterfall diagram, also known as an attrition table, shows how inclusion/exclusion criteria contribute to a final population size. Each inclusion/exclusion criteria is a row in the table, and the number of patients remaining after applying that criteria are shown on that row.

    | Column name | Description |
    | --- | --- |
    | type | The type of the phenotype, either entry, inclusion or exclusion |
    | name | The name of entry, inclusion or exclusion criteria |
    | N | The absolute number of patients that fulfill that phenotype. For the entry criterium this is the absolute number in the dataset. For inclusion/exclusion criteria this is the number of patients that fulfill the entry criterium AND the phenotype and that row. |
    | waterfall | The number of patients remaining in the cohort after sequentially applying the inclusion/exclusion criteria in the order that they are listed in this table. |
    | delta | The change in number of patients that occurs by applying the phenotype on that row. |
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

        self.ds.append(
            {
                "type": "entry",
                "name": cohort.entry_criterion.name,
                "N": table.count().execute(),
                "waterfall": table.count().execute(),
            }
        )

        for inclusion in cohort.inclusions:
            table = self.append_phenotype_to_waterfall(table, inclusion, "inclusion")

        for exclusion in cohort.exclusions:
            table = self.append_phenotype_to_waterfall(table, exclusion, "exclusion")

        self.ds = self.append_delta(self.ds)
        self.df = pd.DataFrame(self.ds)
        return self.df

    def append_phenotype_to_waterfall(self, table, phenotype, type):
        if type in ["inclusion", "exclusion"]:
            table = table.inner_join(
                phenotype.table, table["PERSON_ID"] == phenotype.table["PERSON_ID"]
            )
        else:
            table = table.anti_join(
                phenotype.table, table["PERSON_ID"] == phenotype.table["PERSON_ID"]
            )
        logger.debug(f"Starting {type} criteria {phenotype.name}")
        self.ds.append(
            {
                "type": type,
                "name": phenotype.name,
                "N": phenotype.table.count().execute(),
                "waterfall": table.count().execute(),
            }
        )
        logger.debug(f"Finished {type} criteria {phenotype.name}: N = {self.ds[-1]['N']} waterfall = {self.ds[-1]['waterfall']}")
        return table.select('PERSON_ID')

    def append_delta(self, ds):
        ds[0]['delta'] = None
        for i in range(1,len(ds)):
            d_current = ds[i]
            d_previous = ds[i-1]
            d_current['delta'] = d_current['waterfall'] - d_previous['waterfall']
        return ds