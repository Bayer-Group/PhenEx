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
    ):
        self.name = name
        self.description = description
        self.table = None  # Will be set during execution
        self.subset_tables_index = None  # Will be set during execution
        self.entry_criterion = entry_criterion
        self.inclusions = inclusions if inclusions is not None else []
        self.exclusions = exclusions if exclusions is not None else []
        self.characteristics = characteristics if characteristics is not None else []
        self.derived_tables = derived_tables if derived_tables is not None else []
        self.outcomes = outcomes if outcomes is not None else []

        #
        # Entry stage
        #
        self.subset_tables_entry_nodes = self._get_subset_tables_nodes(
            stage="subset_entry", index_phenotype=entry_criterion
        )
        self.entry_stage = NodeGroup(name="entry", nodes=self.subset_tables_entry_nodes)

        #
        # Derived tables stage
        #
        self.derived_tables_stage = None
        if derived_tables:
            self.derived_tables_stage = NodeGroup(
                name="entry", nodes=self.derived_tables
            )

        #
        # Index stage
        #
        self.inclusions_table_node = None
        self.exclusions_table_node = None
        index_nodes = []
        if inclusions:
            self.inclusions_table_node = InclusionsTableNode(
                name=f"{self.name}__inclusions".upper(),
                index_phenotype=self.entry_criterion,
                phenotypes=self.inclusions,
            )
            index_nodes.append(self.inclusions_table_node)
        if exclusions:
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
            stage="subset_index", index_phenotype=self.index_table_node
        )
        self.index_stage = NodeGroup(
            name="index",
            nodes=self.subset_tables_index_nodes + index_nodes,
        )

        #
        # Post-index / reporting stage
        #
        # Create HStackNodes for characteristics and outcomes
        self.characteristics_table_node = None
        self.outcomes_table_node = None
        self.reporting_stage = None
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
            self.reporting_stage = NodeGroup(name="reporting", nodes=reporting_nodes)

        self._table1 = None

        # Validate that all nodes are unique across all stages
        self._validate_node_uniqueness()

        logger.info(
            f"Cohort '{self.name}' initialized with entry criterion '{self.entry_criterion.name}'"
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

    def _get_subset_tables_nodes(self, stage: str, index_phenotype: Phenotype):
        """
        Get the nodes for subsetting tables for all domains in this cohort subsetting by the given index_phenotype.
        """
        domains = self._get_domains()
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
        tables,
        con: Optional["SnowflakeConnector"] = None,
        overwrite: Optional[bool] = False,
        n_threads: Optional[int] = 1,
        lazy_execution: Optional[bool] = False,
    ):
        """
        The execute method executes the full cohort in order of computation. The order is entry criterion -> inclusion -> exclusion -> baseline characteristics. Tables are subset at two points, after entry criterion and after full inclusion/exclusion calculation to result in subset_entry data (contains all source data for patients that fulfill the entry criterion, with a possible index date) and subset_index data (contains all source data for patients that fulfill all in/ex criteria, with a set index date). Additionally, default reporters are executed such as table 1 for baseline characteristics.

        Parameters:
            tables: A dictionary mapping domains to Table objects
            con: Database connector for materializing outputs
            overwrite: Whether to overwrite existing tables
            lazy_execution: Whether to use lazy execution with change detection
            n_threads: Max number of jobs to run simultaneously.

        Returns:
            PhenotypeTable: The index table corresponding the cohort.
        """
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
        tables = self.get_subset_tables_entry(tables)

        logger.info(f"Cohort '{self.name}': completed entry stage.")
        logger.info(f"Cohort '{self.name}': executing index stage ...")

        self.index_stage.execute(
            tables=tables,
            con=con,
            overwrite=overwrite,
            n_threads=n_threads,
            lazy_execution=lazy_execution,
        )
        self.table = self.index_table_node.table

        logger.info(f"Cohort '{self.name}': completed index stage.")
        logger.info(f"Cohort '{self.name}': executing reporting stage ...")

        self.subset_tables_index = tables = self.get_subset_tables_index(tables)
        if self.reporting_stage:
            self.reporting_stage.execute(
                tables=tables,
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
        """
        Validate that all nodes and dependencies are unique according to the rule:
        node1.name == node2.name implies hash(node1) == hash(node2)

        This ensures that nodes with the same name have identical parameters (same hash).
        """
        name_to_hash = {}

        # Collect all nodes from all stages
        all_nodes = []

        # Add nodes from entry stage
        if hasattr(self, "entry_stage") and self.entry_stage:
            all_nodes += list(self.entry_stage.dependencies)

        # Add nodes from derived tables stage
        if hasattr(self, "derived_tables_stage") and self.derived_tables_stage:
            all_nodes += list(self.derived_tables_stage.dependencies)

        # Add nodes from index stage
        if hasattr(self, "index_stage") and self.index_stage:
            all_nodes += list(self.index_stage.dependencies)

        # Add nodes from reporting stage
        if hasattr(self, "reporting_stage") and self.reporting_stage:
            all_nodes += list(self.reporting_stage.dependencies)

        for node in all_nodes:
            node_name = node.name
            node_hash = hash(node)

            # Check if we've seen this name before
            if node_name in name_to_hash:
                existing_hash = name_to_hash[node_name]
                if existing_hash != node_hash:
                    raise ValueError(
                        f"Duplicate node name found: '{node_name}'."
                        f"Nodes with the same name must have identical parameters."
                    )
            else:
                existing_hash = None
                name_to_hash[node_name] = node_hash


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
        )
        self.cohort = cohort


#
# Helper Nodes -- FIXME move to separate file / namespace
#
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
