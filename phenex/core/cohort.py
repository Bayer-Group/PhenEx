from typing import List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.node import Node, NodeGroup
import ibis
from ibis.expr.types.relations import Table
from phenex.tables import PhenexTable
from phenex.reporting import Table1
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.filters import DateFilter
from phenex.core.data_period_filter_node import DataPeriodFilterNode
from phenex.core.hstack_node import HStackNode
from phenex.core.subset_table import SubsetTable
from phenex.core.inclusions_table_node import InclusionsTableNode
from phenex.core.exclusions_table_node import ExclusionsTableNode
from phenex.core.index_phenotype import IndexPhenotype
from phenex.core.database import Database

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
        description: Optional[str] = None,
        database: Optional[Database] = None,
    ):
        self.name = name
        self.description = description
        self.database = database
        self.table = None  # Will be set during execution to index table
        self.subset_tables_entry = None  # Will be set during execution
        self.subset_tables_index = None  # Will be set during execution
        self.entry_criterion = entry_criterion
        self.inclusions = inclusions or []
        self.exclusions = exclusions or []
        self.characteristics = characteristics or []
        self.derived_tables = derived_tables or []
        self.outcomes = outcomes or []
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
        self.data_period_filter_stage = None

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

    def _validate_node_uniqueness(self):
        # Use Node's capability to check for node uniqueness rather than reimplementing it here
        Node().add_children(self.phenotypes)

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
        if self.database and self.database.data_period:
            data_period_filter_nodes = [
                DataPeriodFilterNode(
                    name=f"{self.name}__data_period_filter_{domain}".upper(),
                    domain=domain,
                    date_filter=self.database.data_period,
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
        tables: Dict[str, PhenexTable] = None,
        con: Optional["SnowflakeConnector"] = None,
        overwrite: Optional[bool] = False,
        n_threads: Optional[int] = 1,
        lazy_execution: Optional[bool] = False,
    ):
        """
        The execute method executes the full cohort in order of computation. The order is data period filter -> derived tables -> entry criterion -> inclusion -> exclusion -> baseline characteristics. Tables are subset at two points, after entry criterion and after full inclusion/exclusion calculation to result in subset_entry data (contains all source data for patients that fulfill the entry criterion, with a possible index date) and subset_index data (contains all source data for patients that fulfill all in/ex criteria, with a set index date). Additionally, default reporters are executed such as table 1 for baseline characteristics.

        There are two ways to use the execute method and thus execute a cohort:

        1. Directly passing source data in the `tables` dictionary
        ```python
        tables = con.get_mapped_tables(mapper)
        cohort.execute(tables)
        ```
        2. Indirectly by defining the data source using the con and mapped_tables keyword arguments at initialization. The source data `tables` is then retrieved at execution time
        ```python
        cohort = Cohort(
            con=SnowflakeConnector(),
            mapper= OMOPDomains,
            ...
        )
        cohort.execute()
        ````

        Parameters:
            tables: A dictionary mapping domains to Table objects. This is optional if the Cohort was initialized with a con and mapper. If passed, this takes precedence over the con and mapper defined at initialization.
            con: Database connector for materializing outputs. If passed, this takes precedence over the con defined at initialization.
            overwrite: Whether to overwrite existing tables
            lazy_execution: Whether to use lazy execution with change detection
            n_threads: Max number of jobs to run simultaneously.

        Returns:
            PhenotypeTable: The index table corresponding the cohort.
        """

        con = self._prepare_database_connector_for_execution(con)
        tables = self._prepare_tables_for_execution(con, tables)

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

    def _prepare_database_connector_for_execution(self, con):
        """
        identify correct connector for cohort execution. If a connector is passed to execute(), use that. Else, if a connector was defined at initialization, use that. Else, raise an error since no connector was provided.
        Parameters:
            con: A database connector passed to execute(). This takes precedence over any connector defined at initialization.
        """
        if con is not None:
            if self.database is not None and con != self.database.connector:
                logger.warning(
                    "Cohort was initialized with a different connector than the one passed to execute(). Using the passed connector."
                )
            return con
        elif self.database is not None:
            logger.warning(
                "Cohort was initialized with a connector but none was passed to execute(). Using the connector from initialization."
            )
            return self.database.connector
        else:
            logger.warning("No database connector provided for cohort execution!")

    def _prepare_tables_for_execution(self, con, tables):
        """
        Docstring for _prepare_tables_for_execution

        Parameters:
            con: A database connector to use for retrieving tables if tables are not passed directly. This is required if tables are not passed directly and the Cohort was initialized with a database.
            tables: Tables passed to execute(). This takes precedence over any tables retrieved from the database defined at initialization.
        """
        if tables is not None:
            return tables
        elif self.database is not None:
            if self.database.mapper is not None:
                logger.warning(
                    "Cohort was initialized with a mapper but no tables were passed to execute(). Using the mapper to retrieve tables for execution."
                )
                tables = self.database.mapper.get_mapped_tables(con)
                return tables
            else:
                raise ValueError(
                    "Cohort was initialized with a database but no tables were passed to execute() and no mapper was defined in the database to retrieve tables for execution!"
                )
        else:
            raise ValueError(
                "No tables provided for cohort execution and no database defined to retrieve tables for execution!"
            )

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
