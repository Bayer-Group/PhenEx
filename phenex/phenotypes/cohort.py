from typing import List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.node import Node, NodeGroup
import ibis
from ibis.expr.types.relations import Table
from phenex.tables import PhenexTable
from phenex.phenotypes.functions import hstack
from phenex.reporting import Table1
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.filters import DateFilter

logger = create_logger(__name__)


class Cohort:
    """
    The Cohort computes a cohort of individuals based on specified entry criteria, inclusions, exclusions, and computes baseline characteristics and outcomes from the extracted index dates.

    Parameters:
        name: A descriptive name for the cohort.
        entry_criterion: The phenotype used to define index date for the cohort.
        inclusions: A list of phenotypes that must evaluate to True for patients to be included in the cohort.
        exclusions: A list of phenotypes that must evaluate to False for patients to be included in the cohort.
        characteristics: A list of phenotypes representing baseline characteristics of the cohort to be computed for all patients passing the inclusion and exclusion criteria.
        outcomes: A list of phenotypes representing outcomes of the cohort.
        description: A plain text description of the cohort.
        data_period: Restrict all input data to a specific date range. The input data will be modified to look as if data outside the data_period was never recorded before any phenotypes are computed. See DataPeriodFilterNode for details on how the input data are affected by this parameter.

    Attributes:
        table (PhenotypeTable): The resulting index table after filtering (None until execute is called)
        inclusions_table (Table): The patient-level result of all inclusion criteria calculations (None until execute is called)
        exclusions_table (Table): The patient-level result of all exclusion criteria calculations (None until execute is called)
        characteristics_table (Table): The patient-level result of all baseline characteristics caclulations. (None until execute is called)
        outcomes_table (Table): The patient-level result of all outcomes caclulations. (None until execute is called)
        subset_tables_entry (Dict[str, PhenexTable]): Tables that have been subset by those patients satisfying the entry criterion.
        subset_tables_index (Dict[str, PhenexTable]): Tables that have been subset by those patients satisfying the entry, inclusion and exclusion criteria.
    """

    def __init__(
        self,
        name: str,
        entry_criterion: Phenotype,
        inclusions: Optional[List[Phenotype]] = None,
        exclusions: Optional[List[Phenotype]] = None,
        characteristics: Optional[List[Phenotype]] = None,
        derived_tables: Optional[List["DerivedTable"]] = None,
        outcomes: Optional[List[Phenotype]] = None,
        data_period: DateFilter = None,
        description: Optional[str] = None,
    ):
        self.name = name
        self.description = description
        self.table = None  # Will be set during execution to index table
        self.subset_tables_entry = None  # Will be set during execution
        self.subset_tables_index = None  # Will be set during execution
        self.entry_criterion = entry_criterion
        self.inclusions = inclusions or []
        self.exclusions = exclusions or []
        self.characteristics = characteristics or []
        self.derived_tables = derived_tables or []
        self.outcomes = outcomes or []
        self.data_period = data_period
        self.n_persons_in_source_database = None

        self.phenotypes = (
            [self.entry_criterion]
            + self.inclusions
            + self.exclusions
            + self.characteristics
            + self.outcomes
        )
        self._validate_node_uniqueness()

        # stages: set at execute() time
        self.derived_tables_stage = None
        self.entry_stage = None
        self.index_stage = None
        self.reporting_stage = None

        # special Nodes that Cohort builds (later, in build_stages())
        # need to be able to refer to later to get outputs
        self.inclusions_table_node = None
        self.exclusions_table_node = None
        self.characteristics_table_node = None
        self.outcomes_table_node = None
        self.index_table_node = None
        self.subset_tables_entry_nodes = None
        self.subset_tables_index_nodes = None
        self._table1 = None

        logger.info(
            f"Cohort '{self.name}' initialized with entry criterion '{self.entry_criterion.name}'"
        )

    def build_stages(self, tables: Dict[str, PhenexTable]):
        """
        Build the computational stages for cohort execution.

        This method constructs the directed acyclic graph (DAG) of computational stages required to execute the cohort. The stages are built in dependency order and include:

        1. **Derived Tables Stage** (optional): Executes any derived table computations
        2. **Entry Stage**: Computes entry phenotype and subsets tables filtered by the entry criterion phenotype
        3. **Index Stage**: Applies inclusion/exclusion criteria and creates the final index table
        4. **Reporting Stage** (optional): Computes characteristics and outcomes tables

        Parameters:
            tables: Dictionary mapping domain names to PhenexTable objects containing the source data tables required for phenotype computation.

        Raises:
            ValueError: If required domains are missing from the input tables.

        Side Effects:
            Sets the following instance attributes:
            - self.entry_stage: NodeGroup for entry criterion processing
            - self.derived_tables_stage: NodeGroup for derived tables (if any)
            - self.index_stage: NodeGroup for inclusion/exclusion processing
            - self.reporting_stage: NodeGroup for characteristics/outcomes (if any)
            - Various table nodes for accessing intermediate results

        Note:
            This method must be called before execute() to initialize the computation graph.
            Node uniqueness is validated across all stages to prevent naming conflicts.
        """
        # Check required domains are present to fail early (note this check is not perfect as _get_domains() doesn't catch everything, e.g., intermediate tables in autojoins, but this is better than nothing)
        domains = list(tables.keys()) + [x.name for x in self.derived_tables]
        required_domains = self._get_domains()
        for d in required_domains:
            if d not in domains:
                raise ValueError(f"Required domain {d} not present in input tables!")

        #
        # Data period filter stage: OPTIONAL
        #
        self.data_period_filter_stage = None
        if self.data_period:
            data_period_filter_nodes = [
                DataPeriodFilterNode(
                    name=f"{self.name}__data_period_filter_{domain}".upper(),
                    domain=domain,
                    date_filter=self.data_period,
                )
                for domain in domains
            ]
            self.data_period_filter_stage = NodeGroup(
                name="data_period_filter", nodes=data_period_filter_nodes
            )

        #
        # Derived tables stage: OPTIONAL
        #
        if self.derived_tables:
            self.derived_tables_stage = NodeGroup(
                name="derived_tables_stage", nodes=self.derived_tables
            )

        #
        # Entry stage: REQUIRED
        #
        self.subset_tables_entry_nodes = self._get_subset_tables_nodes(
            stage="subset_entry", domains=domains, index_phenotype=self.entry_criterion
        )
        self.entry_stage = NodeGroup(
            name="entry_stage", nodes=self.subset_tables_entry_nodes
        )

        #
        # Index stage: REQUIRED
        #
        index_nodes = []
        if self.inclusions:
            self.inclusions_table_node = InclusionsTableNode(
                name=f"{self.name}__inclusions".upper(),
                index_phenotype=self.entry_criterion,
                phenotypes=self.inclusions,
            )
            index_nodes.append(self.inclusions_table_node)
        if self.exclusions:
            self.exclusions_table_node = ExclusionsTableNode(
                name=f"{self.name}__exclusions".upper(),
                index_phenotype=self.entry_criterion,
                phenotypes=self.exclusions,
            )
            index_nodes.append(self.exclusions_table_node)

        self.index_table_node = IndexPhenotype(
            f"{self.name}__index".upper(),
            entry_phenotype=self.entry_criterion,
            inclusion_table_node=self.inclusions_table_node,
            exclusion_table_node=self.exclusions_table_node,
        )
        index_nodes.append(self.index_table_node)
        self.subset_tables_index_nodes = self._get_subset_tables_nodes(
            stage="subset_index", domains=domains, index_phenotype=self.index_table_node
        )
        self.index_stage = NodeGroup(
            name="index_stage",
            nodes=self.subset_tables_index_nodes + index_nodes,
        )

        #
        # Post-index / reporting stage: OPTIONAL
        #
        reporting_nodes = []
        if self.characteristics:
            self.characteristics_table_node = HStackNode(
                name=f"{self.name}__characteristics".upper(),
                phenotypes=self.characteristics,
            )
            reporting_nodes.append(self.characteristics_table_node)
        if self.outcomes:
            self.outcomes_table_node = HStackNode(
                name=f"{self.name}__outcomes".upper(), phenotypes=self.outcomes
            )
            reporting_nodes.append(self.outcomes_table_node)
        if reporting_nodes:
            self.reporting_stage = NodeGroup(
                name="reporting_stage", nodes=reporting_nodes
            )

        self._table1 = None

    def _get_domains(self):
        """
        Get a list of all domains used by any phenotype in this cohort.
        """
        top_level_nodes = (
            [self.entry_criterion]
            + self.inclusions
            + self.exclusions
            + self.characteristics
            + self.outcomes
        )
        all_nodes = top_level_nodes + sum([t.dependencies for t in top_level_nodes], [])

        # FIXME Person domain should not be HARD CODED; however, it IS hardcoded in SCORE phenotype. Remove hardcoding!
        domains = ["PERSON"] + [
            getattr(pt, "domain", None)
            for pt in all_nodes
            if getattr(pt, "domain", None) is not None
        ]

        domains += [
            getattr(getattr(pt, "categorical_filter", None), "domain", None)
            for pt in all_nodes
            if getattr(getattr(pt, "categorical_filter", None), "domain", None)
            is not None
        ]
        domains = list(set(domains))
        return domains

    def _get_subset_tables_nodes(
        self, stage: str, domains: List[str], index_phenotype: Phenotype
    ):
        """
        Get the nodes for subsetting tables for all domains in this cohort subsetting by the given index_phenotype.

        stage: A string for naming the nodes.
        domains: List of domains to subset.
        index_phenotype: The phenotype to use for subsetting patients.
        """
        return [
            SubsetTable(
                name=f"{self.name}__{stage}_{domain}".upper(),
                domain=domain,
                index_phenotype=index_phenotype,
            )
            for domain in domains
        ]

    @property
    def inclusions_table(self):
        if self.inclusions_table_node:
            return self.inclusions_table_node.table

    @property
    def exclusions_table(self):
        if self.exclusions_table_node:
            return self.exclusions_table_node.table

    @property
    def index_table(self):
        return self.index_table_node.table

    @property
    def characteristics_table(self):
        if self.characteristics_table_node:
            return self.characteristics_table_node.table

    @property
    def outcomes_table(self):
        if self.outcomes_table_node:
            return self.outcomes_table_node.table

    def get_subset_tables_entry(self, tables):
        """
        Get the PhenexTable from the ibis Table for subsetting tables for all domains in this cohort subsetting by the given entry_phenotype.
        """
        subset_tables_entry = {}
        for node in self.subset_tables_entry_nodes:
            subset_tables_entry[node.domain] = type(tables[node.domain])(node.table)
        return subset_tables_entry

    def get_subset_tables_index(self, tables):
        """
        Get the PhenexTable from the ibis Table for subsetting tables for all domains in this cohort subsetting by the given index_phenotype.
        """
        subset_tables_index = {}
        for node in self.subset_tables_index_nodes:
            subset_tables_index[node.domain] = type(tables[node.domain])(node.table)
        return subset_tables_index

    def execute(
        self,
        tables: Dict[str, PhenexTable],
        con: Optional["SnowflakeConnector"] = None,
        overwrite: Optional[bool] = False,
        n_threads: Optional[int] = 1,
        lazy_execution: Optional[bool] = False,
    ):
        """
        The execute method executes the full cohort in order of computation. The order is data period filter -> derived tables -> entry criterion -> inclusion -> exclusion -> baseline characteristics. Tables are subset at two points, after entry criterion and after full inclusion/exclusion calculation to result in subset_entry data (contains all source data for patients that fulfill the entry criterion, with a possible index date) and subset_index data (contains all source data for patients that fulfill all in/ex criteria, with a set index date). Additionally, default reporters are executed such as table 1 for baseline characteristics.

        Parameters:
            tables: A dictionary mapping domains to Table objects
            con: Database connector for materializing outputs
            overwrite: Whether to overwrite existing tables
            lazy_execution: Whether to use lazy execution with change detection
            n_threads: Max number of jobs to run simultaneously.

        Returns:
            PhenotypeTable: The index table corresponding the cohort.
        """
        self.n_persons_in_source_database = (
            tables["PERSON"].distinct().count().execute()
        )

        self.build_stages(tables)

        # Apply data period filter first if specified
        if self.data_period_filter_stage:
            logger.info(f"Cohort '{self.name}': executing data period filter stage ...")
            self.data_period_filter_stage.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
            )
            # Update tables with filtered versions
            for node in self.data_period_filter_stage.nodes:
                tables[node.domain] = PhenexTable(node.table)
            logger.info(f"Cohort '{self.name}': completed data period filter stage.")

        if self.derived_tables_stage:
            logger.info(f"Cohort '{self.name}': executing derived tables stage ...")
            self.derived_tables_stage.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
            )
            logger.info(f"Cohort '{self.name}': completed derived tables stage.")
            for node in self.derived_tables:
                tables[node.name] = PhenexTable(node.table)

        logger.info(f"Cohort '{self.name}': executing entry stage ...")

        self.entry_stage.execute(
            tables=tables,
            con=con,
            overwrite=overwrite,
            n_threads=n_threads,
            lazy_execution=lazy_execution,
        )
        self.subset_tables_entry = tables = self.get_subset_tables_entry(tables)

        logger.info(f"Cohort '{self.name}': completed entry stage.")
        logger.info(f"Cohort '{self.name}': executing index stage ...")

        self.index_stage.execute(
            tables=self.subset_tables_entry,
            con=con,
            overwrite=overwrite,
            n_threads=n_threads,
            lazy_execution=lazy_execution,
        )
        self.table = self.index_table_node.table

        logger.info(f"Cohort '{self.name}': completed index stage.")
        logger.info(f"Cohort '{self.name}': executing reporting stage ...")

        self.subset_tables_index = self.get_subset_tables_index(tables)
        if self.reporting_stage:
            self.reporting_stage.execute(
                tables=self.subset_tables_index,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
            )

        return self.index_table

    # FIXME this should be implmemented as a ComputeNode and added to the graph
    @property
    def table1(self):
        if self._table1 is None:
            logger.debug("Generating Table1 report ...")
            reporter = Table1()
            self._table1 = reporter.execute(self)
            logger.debug("Table1 report generated.")
        return self._table1

    def to_dict(self):
        """
        Return a dictionary representation of the Node. The dictionary must contain all dependencies of the Node such that if anything in self.to_dict() changes, the Node must be recomputed.
        """
        return to_dict(self)

    def _validate_node_uniqueness(self):
        # Use Node's capability to check for node uniqueness rather than reimplementing it here
        Node().add_children(self.phenotypes)

    def append_counts(self):
        def append_count_to_phenotype(phenotype):
            phenotype.count = int(
                phenotype.table.select("PERSON_ID").distinct().count().to_pandas()
            )
            if len(phenotype.children) > 0:
                for child in phenotype.children:
                    append_count_to_phenotype(child)

        def append_count_to_phenotypes(phenotypes):
            for phenotype in phenotypes:
                append_count_to_phenotype(phenotype)

        append_count_to_phenotype(self.entry_criterion)
        append_count_to_phenotypes(self.inclusions)
        append_count_to_phenotypes(self.exclusions)
        append_count_to_phenotypes(self.characteristics)
        append_count_to_phenotypes(self.outcomes)


class Subcohort(Cohort):
    """
    A Subcohort derives from a parent cohort and applies additional inclusion /exclusion criteria. The subcohort inherits the entry criterion, inclusion and exclusion criteria from the parent cohort but can add additional filtering criteria.

    Parameters:
        name: A descriptive name for the subcohort.
        cohort: The parent cohort from which this subcohort derives.
        inclusions: Additional phenotypes that must evaluate to True for patients to be included in the subcohort.
        exclusions: Additional phenotypes that must evaluate to False for patients to be included in the subcohort.
    """

    def __init__(
        self,
        name: str,
        cohort: "Cohort",
        inclusions: Optional[List[Phenotype]] = None,
        exclusions: Optional[List[Phenotype]] = None,
    ):
        # Initialize as a regular Cohort with Cohort index table as entry criterion
        additional_inclusions = inclusions or []
        additional_exclusions = exclusions or []
        super(Subcohort, self).__init__(
            name=name,
            entry_criterion=cohort.entry_criterion,
            inclusions=cohort.inclusions + additional_inclusions,
            exclusions=cohort.exclusions + additional_exclusions,
            data_period=cohort.data_period,
        )
        self.cohort = cohort


#
# Helper Nodes -- FIXME move to separate file / namespace
#
class DataPeriodFilterNode(Node):
    """
    A compute node that filters tables by the data period (date range).

    This node ensures that phenotypes only have access to data within the specified date range. The output data should look as if the future (after date_filter.max_date) never happened and the past (before date_filter.min_date) was never observed.

    Filtering Rules:

        1. **EVENT_DATE Column**:
           If an EVENT_DATE column exists, filters the entire table to only include rows where EVENT_DATE falls within the date filter range.

        2. **START_DATE Column** (exact match):
           If a START_DATE column exists, adjusts values to max(original_value, date_filter.min_date) to ensure start dates are not before the study period.

           **Row Exclusion**: If START_DATE is strictly after date_filter.max_date, the entire row is dropped as the period doesn't overlap with the study period.

        3. **END_DATE Column** (exact match):
           If an END_DATE column exists, sets value to NULL if original_value > date_filter.max_date to indicate that the end event occurred outside the observation period.

           **Row Exclusion**: If END_DATE is strictly before date_filter.min_date, the entire row is dropped as the period doesn't overlap with the study period.

        4. **DATE_OF_DEATH Column** (exact match):
           If a DATE_OF_DEATH column exists, sets value to NULL if original_value > date_filter.max_date to indicate that death occurred outside the observation period.

    Parameters:
        name: Unique identifier for this node in the computation graph.
        domain: The name of the table domain to filter (e.g., 'CONDITION_OCCURRENCE', 'DRUG_EXPOSURE').
        date_filter: The date filter containing min_date and max_date constraints.

    Attributes:
        domain: The table domain being filtered.
        date_filter: The date filter with min/max value constraints.

    Examples:
        Example: Basic Date Period Filtering
        ```python
        from phenex.filters import DateFilter
        from phenex.filters.date_filter import AfterOrOn, BeforeOrOn

        # Create date filter for study period 2020
        date_filter = DateFilter(
            min_date=AfterOrOn("2020-01-01"),
            max_date=BeforeOrOn("2020-12-31")
        )

        # Filter condition occurrences table
        filter_node = DataPeriodFilterNode(
            name="CONDITIONS_FILTER",
            domain="CONDITION_OCCURRENCE",
            date_filter=date_filter
        )
        ```

        Example: Condition Occurrence Table (EVENT_DATE based)

        Input CONDITION_OCCURRENCE Table:
        ```
        PERSON_ID | EVENT_DATE | CONDITION_CONCEPT_ID
        ----------|------------|--------------------
        1         | 2019-11-15 | 201826            # Excluded: before study period
        2         | 2020-06-01 | 201826            # Kept: within study period
        3         | 2020-12-31 | 443767            # Kept: within study period
        4         | 2021-02-15 | 443767            # Excluded: after study period
        ```

        After applying DateFilter(2020-01-01 to 2020-12-31):
        ```
        PERSON_ID | EVENT_DATE | CONDITION_CONCEPT_ID
        ----------|------------|--------------------
        2         | 2020-06-01 | 201826
        3         | 2020-12-31 | 443767
        ```

        Example: Drug Exposure Table (START_DATE/END_DATE based)

        Input DRUG_EXPOSURE Table:
        ```
        PERSON_ID | START_DATE | END_DATE   | DRUG_CONCEPT_ID
        ----------|------------|------------|----------------
        1         | 2019-10-01| 2019-11-01| 1124300         # Excluded: ends before study period
        2         | 2019-11-01| 2020-03-01| 1124300         # Kept: overlaps study period (START_DATE adjusted)
        3         | 2020-06-01| 2020-08-01| 1124300         # Kept: entirely within study period
        4         | 2020-10-01| 2021-03-01| 1124300         # Kept: starts in study period (END_DATE nulled)
        5         | 2021-01-01| 2021-06-01| 1124300         # Excluded: starts after study period
        ```

        After applying DateFilter(2020-01-01 to 2020-12-31):
        ```
        PERSON_ID | START_DATE | END_DATE   | DRUG_CONCEPT_ID
        ----------|------------|------------|----------------
        2         | 2020-01-01| 2020-03-01| 1124300         # START_DATE adjusted to study start
        3         | 2020-06-01| 2020-08-01| 1124300         # No changes needed
        4         | 2020-10-01| NULL      | 1124300         # END_DATE nulled (beyond study end)
        ```

        Example: Person Table (DATE_OF_DEATH)

        Input PERSON Table:
        ```
        PERSON_ID | BIRTH_DATE | DATE_OF_DEATH
        ----------|------------|---------------
        1         | 1985-03-15 | 2019-05-10   # Death before study: DATE_OF_DEATH nulled
        2         | 1970-08-22 | 2020-07-15   # Death during study: kept as-is
        3         | 1992-11-30 | 2021-04-20   # Death after study: DATE_OF_DEATH nulled
        4         | 1988-01-05 | NULL         # No death recorded: no change
        ```

        After applying DateFilter(2020-01-01 to 2020-12-31):
        ```
        PERSON_ID | BIRTH_DATE | DATE_OF_DEATH
        ----------|------------|---------------
        1         | 1985-03-15 | NULL
        2         | 1970-08-22 | 2020-07-15
        3         | 1992-11-30 | NULL
        4         | 1988-01-05 | NULL
        ```
    """

    def __init__(self, name: str, domain: str, date_filter: DateFilter):
        super(DataPeriodFilterNode, self).__init__(name=name)
        self.domain = domain
        self.date_filter = date_filter

        # Validate that column_name is EVENT_DATE if specified
        if (
            self.date_filter.column_name is not None
            and self.date_filter.column_name != "EVENT_DATE"
        ):
            raise ValueError(
                f"DataPeriodFilterNode only supports filtering by EVENT_DATE column, but date_filter.column_name is '{self.date_filter.column_name}'. Use EVENT_DATE as the column_name in your DateFilter."
            )

    def _execute(self, tables: Dict[str, Table]) -> Table:
        table = tables[self.domain]
        columns = table.columns

        # 1. Filter rows that fall entirely outside data period
        # These need to be evaluated on the original table BEFORE mutations

        # 1a. Filter self.date_filter.column_name if it exists
        if self.date_filter.column_name in columns:
            table = self.date_filter.filter(table)

        # 1b. Check for exact column name matches (no substring matching)
        start_date_columns = [col for col in ["START_DATE"] if col in columns]
        end_date_columns = [col for col in ["END_DATE"] if col in columns]
        death_date_columns = [col for col in ["DATE_OF_DEATH"] if col in columns]

        # 1b. Filter ranges that fall entirely outside the data period:
        #   START_DATE fields that are strictly after max_date
        #   END_DATE fields that are strictly before min_date
        date_filters = [
            DateFilter(max_date=self.date_filter.max_value, column_name=col)
            for col in start_date_columns
        ]
        date_filters += [
            DateFilter(min_date=self.date_filter.min_value, column_name=col)
            for col in end_date_columns
        ]
        for date_filter in date_filters:
            table = date_filter.filter(table)

        # 2. Build mutations dictionary for column updates
        mutations = {}

        # 2a. Handle START_DATE fields - set to max(column_value, min_date)
        if start_date_columns and self.date_filter.min_value is not None:
            for col in start_date_columns:
                # Respect the operator from min_value
                if self.date_filter.min_value.operator == ">=":
                    # AfterOrOn: use min_value as-is
                    min_date_literal = ibis.literal(self.date_filter.min_value.value)
                elif self.date_filter.min_value.operator == ">":
                    # After: add one day to min_value to ensure start date is after, not on
                    min_date_literal = ibis.literal(
                        self.date_filter.min_value.value
                    ) + ibis.interval(days=1)
                else:
                    raise ValueError(
                        f"Unsupported min_value operator: {self.date_filter.min_value.operator}"
                    )

                mutations[col] = ibis.greatest(table[col], min_date_literal)

        # 2b. Handle END_DATE fields - set to NULL if outside max_date boundary
        if end_date_columns and self.date_filter.max_value is not None:
            for col in end_date_columns:
                # Respect the operator from max_value
                if self.date_filter.max_value.operator == "<=":
                    # BeforeOrOn: set to NULL if date > max_value
                    condition = table[col] > ibis.literal(
                        self.date_filter.max_value.value
                    )
                elif self.date_filter.max_value.operator == "<":
                    # Before: set to NULL if date >= max_value
                    condition = table[col] >= ibis.literal(
                        self.date_filter.max_value.value
                    )
                else:
                    raise ValueError(
                        f"Unsupported max_value operator: {self.date_filter.max_value.operator}"
                    )

                mutations[col] = (
                    ibis.case().when(condition, ibis.null()).else_(table[col]).end()
                )

        # 2c. Handle DATE_OF_DEATH fields - set to NULL if outside max_date boundary
        if death_date_columns and self.date_filter.max_value is not None:
            for col in death_date_columns:
                # Respect the operator from max_value
                if self.date_filter.max_value.operator == "<=":
                    # BeforeOrOn: set to NULL if date > max_value
                    condition = table[col] > ibis.literal(
                        self.date_filter.max_value.value
                    )
                elif self.date_filter.max_value.operator == "<":
                    # Before: set to NULL if date >= max_value
                    condition = table[col] >= ibis.literal(
                        self.date_filter.max_value.value
                    )
                else:
                    raise ValueError(
                        f"Unsupported max_value operator: {self.date_filter.max_value.operator}"
                    )

                mutations[col] = (
                    ibis.case().when(condition, ibis.null()).else_(table[col]).end()
                )

        # Apply all mutations if any exist
        if mutations:
            table = table.mutate(**mutations)

        return table


class HStackNode(Node):
    """
    A compute node that horizontally stacks (joins) multiple phenotypes into a single table. Used for computing characteristics and outcomes tables in cohorts.
    """

    def __init__(
        self, name: str, phenotypes: List[Phenotype], join_table: Optional[Table] = None
    ):
        super(HStackNode, self).__init__(name=name)
        self.add_children(phenotypes)
        self.phenotypes = phenotypes
        self.join_table = join_table

    def _execute(self, tables: Dict[str, Table]) -> Table:
        """
        Execute all phenotypes and horizontally stack their results.

        Args:
            tables: Dictionary of table names to Table objects

        Returns:
            Table: Horizontally stacked table with all phenotype results
        """
        # Stack the phenotype tables horizontally
        return hstack(self.phenotypes, join_table=self.join_table)


class SubsetTable(Node):
    """
    A compute node that creates a subset of a domain table by joining it with an index phenotype.

    This node takes a table from a specific domain and filters it to include only records for patients who have entries in the index phenotype table. The resulting table contains all original columns from the domain table plus an INDEX_DATE column from the index phenotype.

    Parameters:
        name: Name identifier for this subset table node.
        domain: The domain name (e.g., 'PERSON', 'CONDITION_OCCURRENCE') of the table to subset.
        index_phenotype: The phenotype used to filter the domain table. Only patients present in this phenotype's table will be included in the subset.

    Attributes:
        index_phenotype: The phenotype used for subsetting.
        domain: The domain of the table being subset.

    Example:
        ```python
        # Create a subset of the CONDITION_OCCURRENCE table based on diabetes patients
        diabetes_subset = SubsetTable(
            name="DIABETES_CONDITIONS",
            domain="CONDITION_OCCURRENCE",
            index_phenotype=diabetes_phenotype
        )
        ```
    """

    def __init__(self, name: str, domain: str, index_phenotype: Phenotype):
        super(SubsetTable, self).__init__(name=name)
        self.add_children(index_phenotype)
        self.index_phenotype = index_phenotype
        self.domain = domain

    def _execute(self, tables: Dict[str, Table]):
        table = tables[self.domain]
        index_table = self.index_phenotype.table

        # Check if EVENT_DATE exists in the index table
        if "EVENT_DATE" in index_table.columns:
            index_table = index_table.rename({"INDEX_DATE": "EVENT_DATE"})
            columns = list(set(["INDEX_DATE"] + table.columns))
        else:
            logger.warning(
                f"EVENT_DATE column not found in index_phenotype table for SubsetTable '{self.name}'. INDEX_DATE will not be set."
            )
            columns = table.columns

        subset_table = table.inner_join(index_table, "PERSON_ID")
        subset_table = subset_table.select(columns)
        return subset_table


class InclusionsTableNode(Node):
    """
    Compute the inclusions / exclusions table from the individual inclusions / exclusions phenotypes.
    """

    def __init__(
        self, name: str, index_phenotype: Phenotype, phenotypes: List[Phenotype]
    ):
        super(InclusionsTableNode, self).__init__(name=name)
        self.add_children(phenotypes)
        self.add_children(index_phenotype)
        self.phenotypes = phenotypes
        self.index_phenotype = index_phenotype

    def _execute(self, tables: Dict[str, Table]):
        inclusions_table = self.index_phenotype.table.select(["PERSON_ID"])

        for pt in self.phenotypes:
            pt_table = pt.table.select(["PERSON_ID", "BOOLEAN"]).rename(
                **{
                    f"{pt.name}_BOOLEAN": "BOOLEAN",
                }
            )
            inclusions_table = inclusions_table.left_join(pt_table, ["PERSON_ID"])
            columns = inclusions_table.columns
            columns.remove("PERSON_ID_right")
            inclusions_table = inclusions_table.select(columns)

        # fill all nones with False
        boolean_columns = [col for col in inclusions_table.columns if "BOOLEAN" in col]
        for col in boolean_columns:
            inclusions_table = inclusions_table.mutate(
                {col: inclusions_table[col].fill_null(False)}
            )

        inclusions_table = inclusions_table.mutate(
            BOOLEAN=ibis.least(
                *[inclusions_table[f"{x.name}_BOOLEAN"] for x in self.phenotypes]
            )
        )

        return inclusions_table


class ExclusionsTableNode(Node):
    """
    Compute the inclusions / exclusions table from the individual inclusions / exclusions phenotypes.
    """

    def __init__(
        self, name: str, index_phenotype: Phenotype, phenotypes: List[Phenotype]
    ):
        super(ExclusionsTableNode, self).__init__(name=name)
        self.add_children(phenotypes)
        self.add_children(index_phenotype)
        self.phenotypes = phenotypes
        self.index_phenotype = index_phenotype

    def _execute(self, tables: Dict[str, Table]):
        exclusions_table = self.index_phenotype.table.select(["PERSON_ID"])

        for pt in self.phenotypes:
            pt_table = pt.table.select(["PERSON_ID", "BOOLEAN"]).rename(
                **{
                    f"{pt.name}_BOOLEAN": "BOOLEAN",
                }
            )
            exclusions_table = exclusions_table.left_join(pt_table, ["PERSON_ID"])
            columns = exclusions_table.columns
            columns.remove("PERSON_ID_right")
            exclusions_table = exclusions_table.select(columns)

        # fill all nones with False
        boolean_columns = [col for col in exclusions_table.columns if "BOOLEAN" in col]
        for col in boolean_columns:
            exclusions_table = exclusions_table.mutate(
                {col: exclusions_table[col].fill_null(False)}
            )

        # create the boolean inclusions column
        # this is true only if all inclusions criteria are true
        exclusions_table = exclusions_table.mutate(
            BOOLEAN=ibis.greatest(
                *[exclusions_table[f"{x.name}_BOOLEAN"] for x in self.phenotypes]
            )
        )

        return exclusions_table


class IndexPhenotype(Phenotype):
    """
    Compute the index table form the individual inclusions / exclusions phenotypes.
    """

    def __init__(
        self,
        name: str,
        entry_phenotype: Phenotype,
        inclusion_table_node: Node,
        exclusion_table_node: Node,
    ):
        super(IndexPhenotype, self).__init__(name=name)
        self.add_children(entry_phenotype)
        if inclusion_table_node:
            self.add_children(inclusion_table_node)
        if exclusion_table_node:
            self.add_children(exclusion_table_node)

        self.entry_phenotype = entry_phenotype
        self.inclusion_table_node = inclusion_table_node
        self.exclusion_table_node = exclusion_table_node

    def _execute(self, tables: Dict[str, Table]):
        index_table = self.entry_phenotype.table.mutate(INDEX_DATE="EVENT_DATE")

        if self.inclusion_table_node:
            include = self.inclusion_table_node.table.filter(
                self.inclusion_table_node.table["BOOLEAN"] == True
            ).select(["PERSON_ID"])
            index_table = index_table.inner_join(include, ["PERSON_ID"])

        if self.exclusion_table_node:
            exclude = self.exclusion_table_node.table.filter(
                self.exclusion_table_node.table["BOOLEAN"] == False
            ).select(["PERSON_ID"])
            index_table = index_table.inner_join(exclude, ["PERSON_ID"])

        return index_table
