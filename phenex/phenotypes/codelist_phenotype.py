from typing import Union, List, Optional
from phenex.phenotypes.event_phenotype import EventPhenotype
from phenex.filters.codelist_filter import CodelistFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_filter import DateFilter
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.codelists import Codelist
from phenex.tables import is_phenex_code_table, PhenotypeTable


class CodelistPhenotype(EventPhenotype):
    """
    Use CodelistPhenotype to identify patients who have a specific diagnosis, procedure, or drug exposure based on medical codes (e.g. ICD-10, CPT, RxNorm). This is the most commonly used phenotype — use it whenever the clinical concept you need can be defined by a set of codes in a codelist. Supports filtering by date range, relative time range, and categorical filters (e.g. inpatient / outpatient).

    For patients passing all filters, this phenotype returns:
        DATE: The date of the matching event (first, last, nearest, or all depending on return_date).
        VALUE: The matched medical code if return_value='all'; otherwise not populated.

    Parameters:
        domain: The domain of the phenotype.
        codelist: The codelist used for filtering.
        name: The name of the phenotype. Optional. If not passed, name will be derived from
            the name of the codelist.
        date_range: A date range filter to apply.
        relative_time_range: A relative time range filter or a list of filters to apply.
        return_date: Specifies whether to return the 'first', 'last', 'nearest', or 'all'
            event date(s). Default is 'first'.
        return_value: Specifies which values to return. None for no return value or 'all'
            for all return values on the selected date(s). Default is None.
        categorical_filter: Additional categorical filters to apply.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Examples:

    Example: Inpatient Atrial Fibrillation (OMOP)
        ```python
        from phenex.phenotypes import CodelistPhenotype
        from phenex.codelists import Codelist
        from phenex.mappers import OMOPDomains
        from phenex.filters import DateFilter, CategoricalFilter, Value
        from phenex.ibis_connect import SnowflakeConnector

        con = SnowflakeConnector() # requires some configuration
        mapped_tables = OMOPDomains.get_mapped_tables(con)

        af_codelist = Codelist([313217]) # list of concept ids
        date_range = DateFilter(
            min_date=After("2020-01-01"),
            max_date=Before("2020-12-31")
            )

        inpatient = CategoricalFilter(
            column_name='VISIT_DETAIL_CONCEPT_ID',
            allowed_values=[9201],
            domain='VISIT_DETAIL'
        )

        af_phenotype = CodelistPhenotype(
            name="af",
            domain='CONDITION_OCCURRENCE',
            codelist=af_codelist,
            date_range=date_range,
            return_date='first',
            categorical_filter=inpatient
        )

        af = af_phenotype.execute(mapped_tables)
        af.head()
        ```

    Example: Myocardial Infarction One Year Pre-index (OMOP)
        ```python
        from phenex.filters import RelativeTimeRangeFilter, Value

        af_phenotype = (...) # take from above example

        oneyear_preindex = RelativeTimeRangeFilter(
            min_days=Value('>', 0), # exclude index date
            max_days=Value('<', 365),
            anchor_phenotype=af_phenotype # use af phenotype above as reference date
            )

        mi_codelist = Codelist([49601007]) # list of concept ids
        mi_phenotype = CodelistPhenotype(
            name='mi',
            domain='CONDITION_OCCURRENCE',
            codelist=mi_codelist,
            return_date='first',
            relative_time_range=oneyear_preindex
        )
        mi = mi_phenotype.execute(mapped_tables)
        mi.head()
        ```
    """

    def __init__(
        self,
        domain: str,
        codelist: Codelist,
        name: Optional[str] = None,
        date_range: DateFilter = None,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        return_date="first",
        return_value=None,
        categorical_filter: Optional[CategoricalFilter] = None,
        **kwargs,
    ):
        super(CodelistPhenotype, self).__init__(
            domain=domain,
            name=name or codelist.name,
            date_range=date_range,
            relative_time_range=relative_time_range,
            return_date=return_date,
            return_value=return_value,
            categorical_filter=categorical_filter,
            **kwargs,
        )
        self.codelist = codelist
        self.codelist_filter = CodelistFilter(codelist)

    def _perform_codelist_filtering(self, code_table, tables):
        assert is_phenex_code_table(code_table)
        return self.codelist_filter.autojoin_filter(code_table, tables=tables)

    def _execute(self, tables) -> PhenotypeTable:
        code_table = tables[self.domain]
        code_table = self._perform_codelist_filtering(code_table, tables)
        return super()._execute_from_filtered_table(code_table, tables)

    def _perform_value_selection(self, code_table):
        if self.return_value == "all":
            code_table = code_table.mutate(VALUE=code_table.CODE)
        return code_table

    def get_codelists(self) -> List[Codelist]:
        """
        Get all codelists used in the phenotype definition, including all children / dependent phenotypes.

        Returns:
            codeslist: A list of codelists used in the cohort definition.
        """
        codelists = [self.codelist]
        for p in self.children:
            codelists.extend(p.get_codelists())
        return codelists
