import os
import re
from typing import List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.node import Node, NodeGroup
import ibis
from ibis.expr.types.relations import Table
from phenex.tables import PhenexTable
from phenex.ibis_connect import (
    compile_sql,
    ibis_dialect_of_connector,
    read_dialect_stamp,
    read_sql_file,
    write_sql_file,
)
from phenex.reporting import Table1
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.filters import DateFilter
from phenex.core.data_period_filter_node import DataPeriodFilterNode
from phenex.core.database_sampler_node import DatabaseSamplerNode
from phenex.core.hstack_node import HStackNode
from phenex.core.subset_table import SubsetTable
from phenex.core.inclusions_table_node import InclusionsTableNode
from phenex.core.exclusions_table_node import ExclusionsTableNode
from phenex.core.index_phenotype import IndexPhenotype
from phenex.core.reporter_nodes import (
    WaterfallNode,
    Table1Node,
    Table1OutcomesNode,
    CustomReporterNode,
)
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
        derived_tables: A list of derived tables to compute before the entry stage. Their outputs are available as domains for all subsequent stages.
        derived_tables_post_entry: A list of derived tables to compute after the index stage, using index-subset tables. Their outputs are available as domains for the reporting stage.
        outcomes: A list of phenotypes representing outcomes of the cohort.
        description: A plain text description of the cohort.
        data_period: Restrict all input data to a specific date range. The input data will be modified to look as if data outside the data_period was never recorded before any phenotypes are computed. See DataPeriodFilterNode for details on how the input data are affected by this parameter.
        custom_reporters: Additional reporter instances to run on this cohort only, after the default Waterfall and Table1 reporters. Each reporter must implement ``execute(cohort)`` and ``to_json(path)``.
        write_subset_tables_entry: If True (default), materialize the entry-subset tables to the destination database. If False, keep them as lazy expressions instead.
        write_subset_tables_index: If True (default), materialize the index-subset tables to the destination database. If False, keep them as lazy expressions instead.

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
        derived_tables_post_entry: Optional[List["DerivedTable"]] = None,
        outcomes: Optional[List[Phenotype]] = None,
        description: Optional[str] = None,
        database: Optional[Database] = None,
        custom_reporters: Optional[List] = None,
        return_index: str = "first",
        max_index_dates: Optional[int] = None,
        write_subset_tables_entry: bool = True,
        write_subset_tables_index: bool = True,
        write_characteristics_table: bool = True,
        write_outcomes_table: bool = True,
    ):
        self.name = name
        self.description = description
        self.database = database
        self.return_index = return_index
        self.max_index_dates = max_index_dates

        assert return_index in (
            "first",
            "last",
            "all",
        ), f"return_index must be 'first', 'last', or 'all', got '{return_index}'"
        if max_index_dates is not None:
            assert (
                isinstance(max_index_dates, int) and max_index_dates > 0
            ), f"max_index_dates must be a positive integer, got {max_index_dates}"

        # When return_index requires multiple candidate dates, auto-set entry criterion
        if return_index in ("last", "all"):
            if (
                hasattr(entry_criterion, "return_date")
                and entry_criterion.return_date != "all"
            ):
                logger.info(
                    f"Cohort '{name}': return_index='{return_index}' requires entry criterion "
                    f"return_date='all'. Auto-setting from '{entry_criterion.return_date}'."
                )
                entry_criterion.return_date = "all"

        self.write_subset_tables_entry = write_subset_tables_entry
        self.write_subset_tables_index = write_subset_tables_index
        self.write_characteristics_table = write_characteristics_table
        self.write_outcomes_table = write_outcomes_table
        self.table = None  # Will be set during execution to index table
        self.subset_tables_entry = None  # Will be set during execution
        self.subset_tables_index = None  # Will be set during execution
        self.entry_criterion = entry_criterion
        self.inclusions = self._flatten(inclusions)
        self.exclusions = self._flatten(exclusions)

        # characteristics may be a flat list or a dict of {section_name: [phenotypes]}
        if isinstance(characteristics, dict):
            self.characteristic_sections = {
                section: [p.display_name for p in phenos]
                for section, phenos in characteristics.items()
            }
            self.characteristics = [
                p for phenos in characteristics.values() for p in phenos
            ]
        else:
            self.characteristic_sections = None
            self.characteristics = self._flatten(characteristics)

        self.derived_tables = derived_tables
        self.derived_tables_post_entry = derived_tables_post_entry

        # outcomes may be a flat list or a dict of {section_name: [phenotypes]}
        if isinstance(outcomes, dict):
            self.outcome_sections = {
                section: [p.display_name for p in phenos]
                for section, phenos in outcomes.items()
            }
            self.outcomes = [p for phenos in outcomes.values() for p in phenos]
        else:
            self.outcome_sections = None
            self.outcomes = self._flatten(outcomes)

        self.custom_reporters = custom_reporters or []
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
        self.data_period_filter_stage = None
        self.derived_tables_stage = None
        self.entry_stage = None
        self.index_stage = None
        self.subset_index_stage = None
        self.derived_tables_post_entry_stage = None
        self.reporting_stage = None
        self.sampler_stage = self._build_sampler_stage(self._get_domains())

        # special Nodes that Cohort builds (later, in build_stages())
        # need to be able to refer to later to get outputs
        self.inclusions_table_node = None
        self.exclusions_table_node = None
        self.characteristics_table_node = None
        self.outcomes_table_node = None
        self.index_table_node = None
        self.subset_tables_entry_nodes = None
        self.subset_tables_index_nodes = None
        self.table1_node = None
        self.table1_detailed_node = None
        self.table1_outcomes_node = None
        self.table1_outcomes_detailed_node = None
        self.waterfall_node = None
        self.waterfall_detailed_node = None
        self.custom_reporter_nodes = []

        self._apply_table_name_prefix(self.phenotypes)

        logger.info(
            f"Cohort '{self.name}' initialized with entry criterion '{self.entry_criterion.name}'"
        )

    def _build_sampler_stage(self, domains: List[str]) -> Optional["NodeGroup"]:
        """Create the sampler NodeGroup. Returns None when no sampler is configured."""
        if not (self.database and self.database.sampler):
            return None
        _frac = self.database.sampler.fraction
        _seed = self.database.sampler.seed
        _frac_tag = f"f{int(_frac * 100)}_s{_seed}"
        sampler_nodes = [
            DatabaseSamplerNode(
                name=f"{self.name}__sampler_{domain}__{_frac_tag}".upper(),
                domain=domain,
                sampler=self.database.sampler,
            )
            for domain in domains
        ]
        return NodeGroup(
            name=f"{self.name}__sampler_stage__{_frac_tag}".upper(),
            nodes=sampler_nodes,
        )

    @property
    def _table_prefix(self) -> str:
        """Table name prefix for dest DB — appends frac+seed when a sampler is present so same-name cohorts with different sampler params don't collide."""
        if self.database is not None and self.database.sampler is not None:
            frac = int(self.database.sampler.fraction * 100)
            seed = self.database.sampler.seed
            return f"{self.name}_frac{frac}_seed{seed}"
        return self.name

    @property
    def _clean_prefix(self) -> str:
        """`_table_prefix` with non-alphanumerics collapsed to `_` and upper-cased — the exact
        prefix baked into node table names and their saved `.sql` filenames."""
        return re.sub(r"[^A-Za-z0-9_]", "_", self._table_prefix).upper()

    @staticmethod
    def _flatten(items: Optional[List]) -> List:
        """Flatten one level of nesting, so both [p1, p2] and [[p1, p2]] work."""
        if not items:
            return []
        result = []
        for item in items:
            if isinstance(item, list):
                result.extend(item)
            else:
                result.append(item)
        return result

    def _apply_table_name_prefix(self, phenotypes) -> None:
        """Set _table_name_prefix on phenotypes and their dependencies."""
        prefix = self._clean_prefix
        if not isinstance(phenotypes, list):
            phenotypes = [phenotypes]
        for p in phenotypes:
            p._table_name_prefix = prefix
            for dep in p.dependencies:
                dep._table_name_prefix = prefix

    def add_inclusions(self, phenotypes):
        """Add phenotypes to the inclusion criteria."""
        if not isinstance(phenotypes, list):
            phenotypes = [phenotypes]
        self._apply_table_name_prefix(phenotypes)
        self.inclusions.extend(phenotypes)
        self.phenotypes.extend(phenotypes)

    def add_exclusions(self, phenotypes):
        """Add phenotypes to the exclusion criteria."""
        if not isinstance(phenotypes, list):
            phenotypes = [phenotypes]
        self._apply_table_name_prefix(phenotypes)
        self.exclusions.extend(phenotypes)
        self.phenotypes.extend(phenotypes)

    def add_characteristics(self, phenotypes):
        """Add phenotypes to the baseline characteristics."""
        if not isinstance(phenotypes, list):
            phenotypes = [phenotypes]
        self._apply_table_name_prefix(phenotypes)
        self.characteristics.extend(phenotypes)
        self.phenotypes.extend(phenotypes)

    def add_outcomes(self, phenotypes):
        """Add phenotypes to the outcomes."""
        if not isinstance(phenotypes, list):
            phenotypes = [phenotypes]
        self._apply_table_name_prefix(phenotypes)
        self.outcomes.extend(phenotypes)
        self.phenotypes.extend(phenotypes)

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
        # Filter out None tables (tables not found in source data)
        available_tables = {k: v for k, v in tables.items() if v is not None}

        # If a derived table has the same name as a mapped table, the mapped table must be
        # discarded — otherwise _get_subset_tables_nodes would produce two SubsetTable nodes
        # with identical names, causing a duplicate-node error in the execution graph.
        all_derived = list(self.derived_tables or []) + list(
            self.derived_tables_post_entry or []
        )
        for dt in all_derived:
            if dt.name in available_tables:
                logger.warning(
                    f"Derived table '{dt.name}' has the same name as a provided mapped table. "
                    f"The mapped table will be discarded and the derived table will be used for domain '{dt.name}'."
                )
                del available_tables[dt.name]

        domains = list(available_tables.keys())
        required_domains = self._get_domains()

        missing_domains = [d for d in required_domains if d not in domains]
        if missing_domains:
            logger.warning(
                f"Some required domains are not present in input tables: {missing_domains}. "
                f"Phenotypes requiring these domains may fail during execution."
            )

        #
        # Sampler stage: OPTIONAL
        #
        self.sampler_stage = self._build_sampler_stage(domains)

        #
        # Data period filter stage: OPTIONAL
        #
        self.data_period_filter_stage = None
        self.derived_tables_stage = None
        self.derived_tables_post_entry_stage = None
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
        # Derived tables pre-entry stage: OPTIONAL
        #
        if self.derived_tables:
            self.derived_tables_stage = NodeGroup(
                name="derived_tables_stage", nodes=self.derived_tables
            )

        #
        # Entry stage: REQUIRED
        #
        # Pre-entry derived table outputs become new domains available from the entry stage onward.
        pre_entry_derived_domains = [x.name for x in (self.derived_tables or [])]
        entry_domains = domains + pre_entry_derived_domains
        self.subset_tables_entry_nodes = self._get_subset_tables_nodes(
            stage="subset_entry",
            domains=entry_domains,
            index_phenotype=self.entry_criterion,
        )
        self.entry_stage = NodeGroup(
            name="entry_stage", nodes=self.subset_tables_entry_nodes
        )
        #

        # Derived tables post-entry stage: OPTIONAL
        #
        if self.derived_tables_post_entry:
            self.derived_tables_post_entry_stage = NodeGroup(
                name="derived_tables_post_entry_stage",
                nodes=self.derived_tables_post_entry,
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
            return_index=self.return_index,
            max_index_dates=self.max_index_dates,
        )
        index_nodes.append(self.index_table_node)

        # Add Waterfall node after index table (depends on index_table_node)
        self.waterfall_node = WaterfallNode(
            name=f"{self.name}__waterfall".upper(),
            cohort=self,
            index_table_node=self.index_table_node,
        )
        index_nodes.append(self.waterfall_node)
        self.waterfall_detailed_node = WaterfallNode(
            name=f"{self.name}__waterfall_detailed".upper(),
            cohort=self,
            index_table_node=self.index_table_node,
            include_component_phenotypes_level=100,  # include all component phenotypes in the detailed waterfall report
        )
        index_nodes.append(self.waterfall_detailed_node)

        self.subset_tables_index_nodes = self._get_subset_tables_nodes(
            stage="subset_index",
            domains=entry_domains,
            index_phenotype=self.index_table_node,
        )
        if self.write_subset_tables_index:
            # Default: materialize the index-subset tables together with the
            # index nodes in a single multithreaded stage.
            self.subset_index_stage = None
            self.index_stage = NodeGroup(
                name="index_stage",
                nodes=self.subset_tables_index_nodes + index_nodes,
            )
        else:
            # Keep the index-subset tables in a separate stage so they can be
            # executed without materializing to the destination database
            # (see execute()).
            self.index_stage = NodeGroup(
                name="index_stage",
                nodes=index_nodes,
            )
            self.subset_index_stage = NodeGroup(
                name="subset_index_stage",
                nodes=self.subset_tables_index_nodes,
            )

        #
        # Post-index / reporting stage: OPTIONAL
        #
        reporting_nodes = []

        if self.characteristics and self.write_characteristics_table:
            self.characteristics_table_node = HStackNode(
                name=f"{self.name}__characteristics".upper(),
                phenotypes=self.characteristics,
                join_table=self.index_table_node,
            )
            reporting_nodes.append(self.characteristics_table_node)
        if self.outcomes and self.write_outcomes_table:
            self.outcomes_table_node = HStackNode(
                name=f"{self.name}__outcomes".upper(),
                phenotypes=self.outcomes,
                join_table=self.index_table_node,
            )
            reporting_nodes.append(self.outcomes_table_node)

        # Add Table1 node if there are characteristics
        if self.characteristics:
            self.table1_node = Table1Node(
                name=f"{self.name}__table1".upper(),
                cohort=self,
            )
            reporting_nodes.append(self.table1_node)
            self.table1_detailed_node = Table1Node(
                name=f"{self.name}__table1_detailed".upper(),
                cohort=self,
                include_component_phenotypes_level=100,
            )
            reporting_nodes.append(self.table1_detailed_node)

        # Add Table1OutcomesNode if there are outcomes
        if self.outcomes:
            self.table1_outcomes_node = Table1OutcomesNode(
                name=f"{self.name}__table1_outcomes".upper(),
                cohort=self,
            )
            reporting_nodes.append(self.table1_outcomes_node)
            self.table1_outcomes_detailed_node = Table1OutcomesNode(
                name=f"{self.name}__table1_outcomes_detailed".upper(),
                cohort=self,
                include_component_phenotypes_level=100,
            )
            reporting_nodes.append(self.table1_outcomes_detailed_node)

        # Add CustomReporterNodes for each custom reporter
        self.custom_reporter_nodes = []
        for reporter in self.custom_reporters:
            node = CustomReporterNode(
                name=f"{self.name}__custom__{reporter.name}".upper(),
                cohort=self,
                reporter=reporter,
            )
            self.custom_reporter_nodes.append(node)
            reporting_nodes.append(node)

        if reporting_nodes:
            self.reporting_stage = NodeGroup(
                name="reporting_stage", nodes=reporting_nodes
            )

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
            # Skip if table is None (not found in source data)
            if node.table is None:
                continue
            if tables[node.domain] is None:
                continue
            subset_tables_entry[node.domain] = type(tables[node.domain])(node.table)
        return subset_tables_entry

    def get_subset_tables_index(self, tables):
        """
        Get the PhenexTable from the ibis Table for subsetting tables for all domains in this cohort subsetting by the given index_phenotype.
        """
        subset_tables_index = {}
        for node in self.subset_tables_index_nodes:
            # Skip if table is None (not found in source data)
            if node.table is None:
                continue
            if tables.get(node.domain) is None:
                continue
            subset_tables_index[node.domain] = type(tables[node.domain])(node.table)
        return subset_tables_index

    def execute(
        self,
        tables: Dict[str, PhenexTable] = None,
        con: Optional["SnowflakeConnector"] = None,
        overwrite: Optional[bool] = False,
        n_threads: Optional[int] = 1,
        lazy_execution: Optional[bool] = False,
        sql_dir: Optional[str] = "./sql",
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
            sql_dir: Directory to write one .sql file per node (named {NODE_NAME}.sql). These files let node.to_sql() return the executed SQL in a later session. Pass None to disable file writing.

        Returns:
            PhenotypeTable: The index table corresponding the cohort.
        """
        logger.info(f"Cohort '{self.name}': executing cohort execution...")

        con = self._prepare_database_connector_for_execution(con)
        tables = dict(self._prepare_tables_for_execution(con, tables))
        logger.info(
            f"Cohort '{self.name}': tables prepared. Counting persons in source database..."
        )

        self.n_persons_in_source_database = (
            tables["PERSON"].distinct().count().execute()
        )
        logger.info(
            f"Cohort '{self.name}': {self.n_persons_in_source_database} persons in source database. Building stages..."
        )

        self.build_stages(tables)
        logger.info(f"Cohort '{self.name}': stages built. Executing sampler stage...")

        if self.sampler_stage:
            logger.info(
                f"Cohort '{self.name}': executing sampler stage. Sampling {self.n_persons_in_source_database} persons..."
            )
            self.sampler_stage.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
                table_name_prefix=self._table_prefix,
            )
            # If the tables were already cached, we reuse them and skip sample(),
            # list never gets saved.
            # Build it again here so fetch_person_ids() always works.
            sampler = self.database.sampler
            if sampler._person_ids_expr is None:
                person_tbl = tables.get("PERSON")
                if person_tbl is not None:
                    person_ibis = (
                        person_tbl.table
                        if isinstance(person_tbl, PhenexTable)
                        else person_tbl
                    )
                    sampler._person_ids_expr = sampler._sampled_person_ids(person_ibis)

            # Swap in the sampled table for each domain, so the later steps use the smaller
            # sampled data instead of the full tables.
            for node in self.sampler_stage.children:
                if node.table is not None:
                    original = tables.get(node.domain)
                    sampled = node.table
                    if isinstance(original, PhenexTable) and not isinstance(
                        sampled, PhenexTable
                    ):
                        sampled = type(original)(
                            sampled, name=original.NAME_TABLE, column_mapping={}
                        )
                    node.table = sampled
                    tables[node.domain] = sampled
            logger.info(f"Cohort '{self.name}': completed sampler stage.")

        # Apply data period filter first if specified
        if self.data_period_filter_stage:
            logger.info(f"Cohort '{self.name}': executing data period filter stage ...")
            self.data_period_filter_stage.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
                table_name_prefix=self._table_prefix,
            )
            # Update tables with filtered versions (only when the node actually modified the table;
            # nodes with no relevant date columns return None and the original table is kept)
            for node in self.data_period_filter_stage.children:
                if node.table is not None:
                    original = tables.get(node.domain)
                    filtered = node.table
                    if isinstance(original, PhenexTable) and not isinstance(
                        filtered, PhenexTable
                    ):
                        filtered = type(original)(
                            filtered, name=original.NAME_TABLE, column_mapping={}
                        )
                    node.table = filtered
                    tables[node.domain] = filtered
            logger.info(f"Cohort '{self.name}': completed data period filter stage.")

        if self.derived_tables_stage:
            logger.info(
                f"Cohort '{self.name}': executing derived tables pre-entry stage ..."
            )
            self.derived_tables_stage.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
                table_name_prefix=self._table_prefix,
            )
            logger.info(
                f"Cohort '{self.name}': completed derived tables pre-entry stage."
            )
            for node in self.derived_tables:
                tables[node.name] = PhenexTable(node.table)

        logger.info(f"Cohort '{self.name}': executing entry stage ...")

        if self.write_subset_tables_entry:
            self.entry_stage.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
                table_name_prefix=self._table_prefix,
            )
        else:
            # Execute entry criterion in-memory so .table stays on the source
            # backend, avoiding cross-backend joins with subset tables.
            self.entry_criterion.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                table_name_prefix=self._table_prefix,
                lazy_execution=lazy_execution,
            )

            # Remove entry_criterion from subset table children so it won't be
            # re-executed; its .table is already set and SubsetTable._execute
            # accesses it via self.index_phenotype.table.
            for node in self.subset_tables_entry_nodes:
                node._children = [
                    c for c in node._children if c is not self.entry_criterion
                ]
            self.entry_stage.execute(
                tables=tables,
                con=None,
                overwrite=overwrite,
                n_threads=n_threads,
                table_name_prefix=self._table_prefix,
            )
            # Restore children for correct dependency graphs in later stages
            for node in self.subset_tables_entry_nodes:
                node._children.insert(0, self.entry_criterion)

        self.subset_tables_entry = tables = self.get_subset_tables_entry(tables)

        logger.info(f"Cohort '{self.name}': completed entry stage.")

        if self.derived_tables_post_entry_stage:
            logger.info(
                f"Cohort '{self.name}': executing derived tables post-entry stage ..."
            )
            self.derived_tables_post_entry_stage.execute(
                tables=self.subset_tables_entry,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
                table_name_prefix=self._table_prefix,
            )
            logger.info(
                f"Cohort '{self.name}': completed derived tables post-entry stage."
            )
            entry_dates = self.entry_criterion.table.select(
                "PERSON_ID", "EVENT_DATE"
            ).rename({"INDEX_DATE": "EVENT_DATE"})
            # TODO this is a bit hacky, consider a cleaner way to handle this if we want to support post-entry derived tables in the long term i.e. a DERIVED_TABLES class that adds index table automatically if present in the source derived table.
            for node in self.derived_tables_post_entry:
                table_with_index = node.table.join(entry_dates, "PERSON_ID")
                self.subset_tables_entry[node.name] = PhenexTable(table_with_index)
            tables = self.subset_tables_entry

        logger.info(f"Cohort '{self.name}': executing index stage ...")

        self.index_stage.execute(
            tables=self.subset_tables_entry,
            con=con,
            overwrite=overwrite,
            n_threads=n_threads,
            lazy_execution=lazy_execution,
            table_name_prefix=self._table_prefix,
        )
        self.table = self.index_table_node.table

        if not self.write_subset_tables_index:
            # Execute the index-subset tables in-memory so they are not
            # materialized to the destination database. The index table is
            # already computed, so detach it from the subset nodes' children to
            # avoid re-executing it; SubsetTable accesses it via
            # self.index_phenotype.table.
            for node in self.subset_tables_index_nodes:
                node._children = [
                    c for c in node._children if c is not self.index_table_node
                ]
            self.subset_index_stage.execute(
                tables=self.subset_tables_entry,
                con=None,
                overwrite=overwrite,
                n_threads=n_threads,
                table_name_prefix=self._table_prefix,
            )
            # Restore children for correct dependency graphs in later stages
            for node in self.subset_tables_index_nodes:
                node._children.insert(0, self.index_table_node)

        logger.info(f"Cohort '{self.name}': completed index stage.")
        logger.info(f"Cohort '{self.name}': executing reporting stage ...")

        self.subset_tables_index = self.get_subset_tables_index(tables)

        # Also add derived post-entry tables to subset_tables_index, further filtered
        # to only include persons that passed all inclusion/exclusion criteria.
        if self.derived_tables_post_entry:
            index_person_ids = self.index_table_node.table.select("PERSON_ID")
            for node in self.derived_tables_post_entry:
                if node.name in self.subset_tables_entry:
                    entry_tbl = self.subset_tables_entry[node.name]
                    filtered_ibis = entry_tbl.table.semi_join(
                        index_person_ids, "PERSON_ID"
                    )
                    self.subset_tables_index[node.name] = type(entry_tbl)(filtered_ibis)

        if self.reporting_stage:
            logger.info(f"Cohort '{self.name}': executing reporting stage ...")
            self.reporting_stage.execute(
                tables=self.subset_tables_index,
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
                table_name_prefix=self._table_prefix,
            )

        self._write_node_sql_files(sql_dir, con, overwrite)

        return self.index_table

    def _write_node_sql_files(self, sql_dir, con, overwrite):
        """Write one .sql per node (+ codelist sidecars) into `sql_dir`, named by get_table_name().
        Overwrite drops this cohort's orphan .sql, lazy hits restore from phenex.db.
        """
        if sql_dir is not None:
            # Remember where we wrote so a later to_sql() can default to it.
            self._last_sql_dir = sql_dir
            try:
                os.makedirs(sql_dir, exist_ok=True)
            except OSError as e:
                logger.warning(
                    f"Cohort '{self.name}': could not create SQL directory '{sql_dir}': {e}. "
                    f"Skipping SQL file output."
                )
            else:
                all_nodes = self._collect_all_nodes()
                if overwrite:
                    # Drop this cohort's orphan .sql (nodes removed since an earlier run), prefix-scoped.
                    current_files = {n.get_sql_filename() for n in all_nodes}
                    prefix = self._clean_prefix + "__"
                    for fname in os.listdir(sql_dir):
                        if (
                            fname.endswith(".sql")
                            and fname.startswith(prefix)
                            and fname not in current_files
                        ):
                            try:
                                os.remove(os.path.join(sql_dir, fname))
                            except OSError:
                                pass
                from phenex.core.sql_view import (
                    REUSED_CODELIST_NOTE,
                    referenced_sidecars,
                )

                target_dialect = ibis_dialect_of_connector(con)
                cache_hit_missing_sidecars = (
                    0  # nodes restored from cache with a sidecar gap
                )
                for node in all_nodes:
                    filename = node.get_sql_filename()
                    filepath = os.path.join(sql_dir, filename)
                    if node._expression is not None:
                        try:
                            # Compile in the connector's dialect, stamped.
                            write_sql_file(
                                filepath,
                                compile_sql(node._expression, dialect=target_dialect),
                            )
                            # Also dump any codelist this node uses as a sidecar.
                            self._write_codelist_sidecars(node._expression, sql_dir)
                        except Exception as e:
                            logger.warning(
                                f"Cohort '{self.name}': could not write SQL file for node "
                                f"'{node.name}': {e}. Skipping."
                            )
                    else:
                        # Lazy hit (no live expression): restore from phenex.db if missing or wrong-dialect.
                        needs_restore = not os.path.exists(filepath)
                        if not needs_restore and target_dialect is not None:
                            try:
                                existing_stamp = read_dialect_stamp(
                                    read_sql_file(filepath)
                                )
                            except Exception:
                                existing_stamp = None
                            if (
                                existing_stamp is not None
                                and existing_stamp != target_dialect
                            ):
                                needs_restore = True
                        if not needs_restore:
                            continue
                        # Dialect-aware lookup: only accept SQL cached for this backend.
                        sql = Node._node_manager.get_sql(node, con=con)
                        if sql is not None:
                            try:
                                write_sql_file(filepath, sql)
                            except Exception as e:
                                logger.warning(
                                    f"Cohort '{self.name}': could not restore SQL file for node "
                                    f"'{node.name}' from phenex.db: {e}. Skipping."
                                )
                            else:
                                # Cache hits restore node SQL but not sidecars. Tally nodes
                                # whose restored query needs a memtable file this folder lacks,
                                # so we can warn once after the loop instead of per node.
                                if any(
                                    not os.path.exists(
                                        os.path.join(sql_dir, f"{m}.sql")
                                    )
                                    for m in referenced_sidecars(sql)
                                ):
                                    cache_hit_missing_sidecars += 1
                        elif not os.path.exists(filepath):
                            logger.warning(
                                f"Cohort '{self.name}': no saved SQL found for node "
                                f"'{node.name}' — its file is missing and nothing is cached. "
                                f"Call node.to_sql() to rebuild it from its dependencies, or "
                                f"re-run the cohort with a full (non-incremental) execution to "
                                f"regenerate every SQL file."
                            )
                if cache_hit_missing_sidecars:
                    logger.info(f"Cohort '{self.name}': {REUSED_CODELIST_NOTE}")
                # Count .sql present now (accurate on a lazy hit). A shortfall means a warning above.
                n_present = sum(
                    1
                    for node in all_nodes
                    if os.path.exists(os.path.join(sql_dir, node.get_sql_filename()))
                )
                logger.info(
                    f"Cohort '{self.name}': {n_present}/{len(all_nodes)} node SQL "
                    f"file(s) available in '{sql_dir}'"
                )

    @staticmethod
    def _codelist_values_sql(frame) -> str:
        """Render a codelist DataFrame as a self-contained `VALUES` subquery."""

        def lit(v):
            if v is None or v != v:  # None or NaN
                return "NULL"
            if isinstance(v, bool):
                return "TRUE" if v else "FALSE"
            if isinstance(v, (int, float)):
                return repr(v)
            return "'" + str(v).replace("'", "''") + "'"

        # Quote each column so the alias matches ibis's quoted-lowercase refs (e.g. "t3"."code") on any backend.
        cols = ", ".join('"' + str(c) + '"' for c in frame.columns)
        rows = [
            "(" + ", ".join(lit(v) for v in row) + ")"
            for row in frame.itertuples(index=False, name=None)
        ]
        body = (
            ",\n  ".join(rows)
            if rows
            else "(" + ", ".join("NULL" for _ in frame.columns) + ")"
        )
        return (
            "-- Self-contained codelist contents: a drop-in for the in-memory table that the\n"
            '-- codelist node SQL joins to. Replace  FROM "ibis_pandas_memtable_..."  with\n'
            "-- FROM ( this query ) to make that node SQL portable across sessions.\n"
            f"SELECT * FROM (VALUES\n  {body}\n) AS t({cols})\n"
        )

    def _write_codelist_sidecars(self, expression, sql_dir: str) -> None:
        """Write a self-contained `VALUES` sidecar (`{memtable_name}.sql`) for each codelist the
        node references, so the codes stay on disk, deduped."""
        import ibis.expr.operations as ops

        try:
            memtables = list(expression.op().find(ops.InMemoryTable))
        except Exception:
            return
        for memtable in memtables:
            name = getattr(memtable, "name", "") or ""
            if not name.startswith("ibis_pandas_memtable"):
                continue  # a named table (e.g. a mock source table), not a codelist
            path = os.path.join(sql_dir, f"{name}.sql")
            if os.path.exists(path):
                continue  # already written for another node referencing the same codelist
            try:
                write_sql_file(
                    path, self._codelist_values_sql(memtable.data.to_frame())
                )
            except Exception as e:
                logger.warning(
                    f"Cohort '{self.name}': could not write codelist sidecar "
                    f"'{name}.sql': {e}. Skipping."
                )

    def _collect_all_nodes(self) -> List[Node]:
        """Every SQL artifact this cohort produces, deduped and order preserving."""
        seen, ordered = set(), []

        def add(node):
            if (
                node is not None
                and not isinstance(node, NodeGroup)
                and id(node) not in seen
            ):
                seen.add(id(node))
                ordered.append(node)

        roots = []
        for stage in (
            self.data_period_filter_stage,
            self.derived_tables_stage,
            self.entry_stage,
            self.derived_tables_post_entry_stage,
            self.index_stage,
            self.subset_index_stage,
            self.reporting_stage,
            self.sampler_stage,
        ):
            if stage is not None:
                roots.extend(stage.nodes)
        roots += [
            self.entry_criterion,
            *self.inclusions,
            *self.exclusions,
            *self.characteristics,
            *self.outcomes,
            self.index_table_node,
            self.inclusions_table_node,
            self.exclusions_table_node,
        ]
        for root in roots:
            if root is not None:
                for node in [*root.dependencies, root]:
                    add(node)
        return ordered

    def to_sql(self, sql_dir: Optional[str] = None, connector=None):
        """Return a lazy, dict-like view of this cohort's SQL, keyed by node table name.

        Pass `sql_dir=".../sql"` for a guaranteed read of the saved files on any
        machine. Zero-arg reads from memory (same session) or the `phenex.db` cache
        (fresh session, only after a lazy `execute()` here). Indexing a node resolves
        just that query, returning `None` with a warning if it is nowhere.

        Parameters:
            sql_dir: Directory of saved `.sql` files, defaults to the last `execute()` run.
            connector: Pins the SQL dialect, defaults to the cohort's database connector.
        """
        from phenex.core.sql_view import announce_sql_source, build_sql_view

        connector = connector or (
            self.database.connector if self.database is not None else None
        )
        sql_dir = sql_dir or getattr(self, "_last_sql_dir", None)

        # index/inclusions/exclusions become objects only inside execute(). In a fresh
        # session they are None, so rebuild those three from the phenotypes (no query).
        if self.index_table_node is None:
            self._build_rollup_nodes()
        # Say up front where the SQL is read from, so a short or surprising list is traceable.
        announce_sql_source(
            f"Cohort '{self.name}'",
            sql_dir,
            "phenotypes only, no subset tables, reporters, or sidecars",
        )
        return build_sql_view(self._collect_all_nodes(), sql_dir, connector)

    def _build_rollup_nodes(self):
        """Re-create the index, inclusions, and exclusions node objects with no database
        query. execute() normally builds these, a fresh session has them as None. They
        come only from the cohort's own phenotypes (already in memory), and get the
        cohort prefix so their names match the .sql files execute() wrote."""
        if self.inclusions:
            self.inclusions_table_node = InclusionsTableNode(
                name=f"{self.name}__inclusions".upper(),
                index_phenotype=self.entry_criterion,
                phenotypes=self.inclusions,
            )
        if self.exclusions:
            self.exclusions_table_node = ExclusionsTableNode(
                name=f"{self.name}__exclusions".upper(),
                index_phenotype=self.entry_criterion,
                phenotypes=self.exclusions,
            )
        self.index_table_node = IndexPhenotype(
            f"{self.name}__index".upper(),
            entry_phenotype=self.entry_criterion,
            inclusion_table_node=self.inclusions_table_node,
            exclusion_table_node=self.exclusions_table_node,
            return_index=self.return_index,
            max_index_dates=self.max_index_dates,
        )
        # Match the cohort-prefixed names execute() writes to disk.
        prefix = self._clean_prefix
        for node in (
            self.index_table_node,
            self.inclusions_table_node,
            self.exclusions_table_node,
        ):
            if node is not None:
                node._table_name_prefix = prefix

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

    @property
    def table1(self):
        """Get the Table1 report DataFrame from the table1_node if it exists."""
        if self.table1_node:
            return self.table1_node.df_report
        return None

    @property
    def waterfall(self):
        """Get the Waterfall report DataFrame from the waterfall_node if it exists."""
        if self.waterfall_node:
            return self.waterfall_node.df_report
        return None

    @property
    def waterfall_detailed(self):
        """Get the detailed Waterfall report DataFrame from the waterfall_node if it exists."""
        if self.waterfall_detailed_node:
            return self.waterfall_detailed_node.df_report
        return None

    def write_reports_to_excel(self, path: str):
        """Write all available reports (table1, waterfall, waterfall_detailed) to Excel files in the given directory."""
        if self.table1_node:
            self.table1_node.to_excel(os.path.join(path, "table1.xlsx"))
        if self.table1_detailed_node:
            self.table1_detailed_node.to_excel(
                os.path.join(path, "table1_detailed.xlsx")
            )
        if self.table1_outcomes_node:
            self.table1_outcomes_node.to_excel(
                os.path.join(path, "table1_outcomes.xlsx")
            )
        if self.table1_outcomes_detailed_node:
            self.table1_outcomes_detailed_node.to_excel(
                os.path.join(path, "table1_outcomes_detailed.xlsx")
            )
        if self.waterfall_node:
            self.waterfall_node.to_excel(os.path.join(path, "waterfall.xlsx"))
        if self.waterfall_detailed_node:
            self.waterfall_detailed_node.to_excel(
                os.path.join(path, "waterfall_detailed.xlsx")
            )
        for custom_reporter_node in self.custom_reporter_nodes:
            report_filename = custom_reporter_node.reporter.name
            custom_reporter_node.to_excel(os.path.join(path, report_filename + ".xlsx"))

    def write_reports_to_json(self, path: str):
        """Write all available reports as JSON files (machine-readable intermediate format)."""
        if self.table1_node:
            self.table1_node.to_json(os.path.join(path, "table1.json"))
        if self.table1_detailed_node:
            self.table1_detailed_node.to_json(
                os.path.join(path, "table1_detailed.json")
            )
        if self.table1_outcomes_node:
            self.table1_outcomes_node.to_json(
                os.path.join(path, "table1_outcomes.json")
            )
        if self.table1_outcomes_detailed_node:
            self.table1_outcomes_detailed_node.to_json(
                os.path.join(path, "table1_outcomes_detailed.json")
            )
        if self.waterfall_node:
            self.waterfall_node.to_json(os.path.join(path, "waterfall.json"))
        if self.waterfall_detailed_node:
            self.waterfall_detailed_node.to_json(
                os.path.join(path, "waterfall_detailed.json")
            )
        for custom_reporter_node in self.custom_reporter_nodes:
            report_filename = custom_reporter_node.reporter.name
            custom_reporter_node.to_json(os.path.join(path, report_filename + ".json"))

    def write_reports_to_html(self, path: str):
        """Write HTML reports for custom reporters that implement to_html."""
        for custom_reporter_node in self.custom_reporter_nodes:
            if hasattr(custom_reporter_node.reporter, "to_html"):
                report_filename = custom_reporter_node.reporter.name
                custom_reporter_node.to_html(
                    os.path.join(path, report_filename + ".html")
                )

    def delete_tables(self, con, sections=None):
        """
        Delete materialized tables from the destination database.

        Parameters:
            con: Database connector.
            sections: List of section names to delete. If None, deletes all sections.
                Valid section names: 'entry_inclusion_exclusion', 'subset_tables_entry',
                'subset_tables_index', 'characteristics', 'outcomes', 'reporters'.
        """
        all_sections = {
            "entry_inclusion_exclusion": self.delete_entry_inclusion_exclusion,
            "subset_tables_entry": self.delete_subset_tables_entry,
            "subset_tables_index": self.delete_subset_tables_index,
            "characteristics": self.delete_characteristics,
            "outcomes": self.delete_outcomes,
            "reporters": self.delete_reporters,
        }
        if sections is None:
            sections = list(all_sections.keys())
        for section in sections:
            if section not in all_sections:
                raise ValueError(
                    f"Unknown section '{section}'. Valid sections: {list(all_sections.keys())}"
                )
            all_sections[section](con)

    def delete_entry_inclusion_exclusion(self, con):
        """Delete entry criterion, inclusion, and exclusion phenotype tables."""
        nodes = [self.entry_criterion] + self.inclusions + self.exclusions

        for node in nodes:
            node.delete_table(con)
            for dep in node.dependencies:
                dep.delete_table(con)
        if self.inclusions_table_node:
            self.inclusions_table_node.delete_table(con)
        if self.exclusions_table_node:
            self.exclusions_table_node.delete_table(con)
        if self.index_table_node:
            self.index_table_node.delete_table(con)

    def _get_tables_and_build_stages(self, con, tables=None):
        con = self._prepare_database_connector_for_execution(con)
        tables = self._prepare_tables_for_execution(con, tables)
        self.build_stages(tables)
        return con, tables

    def delete_subset_tables_entry(self, con):
        """Delete subset tables created after entry filtering."""
        if not self.subset_tables_entry_nodes:
            self._get_tables_and_build_stages(con)

        for node in self.subset_tables_entry_nodes:
            node.delete_table(con)

    def delete_subset_tables_index(self, con):
        """Delete subset tables created after index filtering."""
        if not self.subset_tables_index_nodes:
            self._get_tables_and_build_stages(con)

        for node in self.subset_tables_index_nodes:
            node.delete_table(con)

    def delete_characteristics(self, con):
        """Delete baseline characteristics phenotype tables."""
        for node in self.characteristics:
            node.delete_table(con)
            for dep in node.dependencies:
                dep.delete_table(con)
        if self.characteristics_table_node:
            self.characteristics_table_node.delete_table(con)

    def delete_outcomes(self, con):
        """Delete outcome phenotype tables."""
        for node in self.outcomes:
            node.delete_table(con)
            for dep in node.dependencies:
                dep.delete_table(con)
        if self.outcomes_table_node:
            self.outcomes_table_node.delete_table(con)

    def delete_reporters(self, con):
        """Delete reporter tables (table1, waterfall, custom reporters)."""

        if not self.waterfall_node:
            self._get_tables_and_build_stages(con)

        reporter_nodes = [
            self.table1_node,
            self.table1_detailed_node,
            self.table1_outcomes_node,
            self.table1_outcomes_detailed_node,
            self.waterfall_node,
            self.waterfall_detailed_node,
        ] + self.custom_reporter_nodes
        for node in reporter_nodes:
            if node:
                node.delete_table(con)

    def to_dict(self):
        """
        Return a dictionary representation of the Node. The dictionary must contain all dependencies of the Node such that if anything in self.to_dict() changes, the Node must be recomputed.
        """
        d = to_dict(self)
        # custom_reporters are runtime execution objects and cannot be meaningfully
        # serialized; drop them from the frozen cohort definition.
        d.pop("custom_reporters", None)
        return d

    def get_codelists(self, as_dataframe=False):
        """
        Get a dictionary of all codelists used in any phenotype in this cohort. The keys are the codelist names and the values are the codelist objects.
        """
        top_level_nodes = (
            [self.entry_criterion]
            + self.inclusions
            + self.exclusions
            + self.characteristics
            + self.outcomes
        )
        all_nodes = top_level_nodes + sum([t.dependencies for t in top_level_nodes], [])
        codelists = {
            pt.display_name: pt.codelist
            for pt in all_nodes
            if getattr(pt, "codelist", None) is not None
        }
        if as_dataframe:
            import pandas as pd

            _dfs = []
            for name_pt, codelist in codelists.items():
                codelist_df = codelist.df
                codelist_df["phenotype"] = name_pt
                _dfs.append(codelist_df)
            codelists_df = pd.concat(_dfs, ignore_index=True)
            return codelists_df

        return codelists
