import pandas as pd

from .reporter import Reporter


class WaterfallDiagram(Reporter):
    """


    """

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        self.cohort = cohort
        N = (
            cohort.index_table.filter(cohort.index_table.BOOLEAN == True)
            .select("PERSON_ID")
            .distinct()
            .count()
            .execute()
        )
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
        self.ds.append(
            {
                "type": type,
                "name": phenotype.name,
                "N": phenotype.table.count().execute(),
                "waterfall": table.count().execute(),
            }
        )
        return table.select('PERSON_ID')
