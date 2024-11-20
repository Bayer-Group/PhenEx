from typing import Dict, Union
from ibis.expr.types.relations import Table
from phenex.tables import (
    PhenotypeTable,
    PHENOTYPE_TABLE_COLUMNS,
    is_phenex_phenotype_table,
)


class Phenotype:
    """
    All Phenotype's in PhenEx derive from the Phenotype class. Phenotype's take in the complete specification of what the Phenotype
    must compute. Phenotypes are not executed until execute() is called; the execute() method takes in a DomainsMapping and returns
    a single PhenotypeTable. Phenotypes depend on other phenotypes and execute recursively.

    To subclass:
        1. define self.children in __init__()
        2. define self._execute

    self.children is a list of Phenotype's which must be executed before the current Phenotype, allowing Phenotype's to be chained and
    executed recursively. The self._execute() method is reponsible for interpreting the input parameters to the Phenotype and returning
    the appropriate PhenotypeTable.
    """

    def __init__(self):
        self.table = (
            None  # self.table is populated ONLY AFTER self.execute() is called!
        )
        self._namespaced_table = None
        self.children = []  # List[Phenotype]
        self._check_for_children()

    def execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        """
        Executes the phenotype computation for the current object and its children.
        This method iterates over the children of the current object and calls their
        execute method if their table attribute is None. It then calls the _execute
        method to perform the actual computation for the current object. The resulting
        table is checked to ensure it contains the required phenotype columns. If the
        required columns are present, the table is filtered to include only these columns
        and assigned to the table attribute of the current object.

        Args:
            tables (Dict[str, Table]): A dictionary of table names to Table objects.

        Returns:
            PhenotypeTable: The resulting phenotype table containing the required columns.

        Raises:
            ValueError: If the table returned by _execute() does not contain the required phenotype
            columns.
        """
        for child in self.children:
            if child.table is None:
                child.execute(tables)

        table = self._execute(tables).mutate(BOOLEAN=True)

        if not set(PHENOTYPE_TABLE_COLUMNS) <= set(table.columns):
            raise ValueError(
                f"Phenotype {self.name} must return columns {PHENOTYPE_TABLE_COLUMNS}. Found {table.columns}."
            )

        self.table = table.select(PHENOTYPE_TABLE_COLUMNS)
        assert is_phenex_phenotype_table(self.table)

        return self.table

    @property
    def namespaced_table(self) -> Table:
        """
        The phenotype.table has columns 'person_id', 'boolean', 'event_date', and 'value'. The namespaced_table
        appends the phenotype name to all of these columns. This is useful when joining multiple phenotype tables
        together

        Returns:
            Table: The namespaced table for the current phenotype.
        """
        if self._namespaced_table is None:
            if self.table is None:
                raise ValueError("Phenotype has not been executed yet.")
            new_column_names = {
                "PERSON_ID": "PERSON_ID",
                f"{self.name}_BOOLEAN": "BOOLEAN",
                f"{self.name}_EVENT_DATE": "EVENT_DATE",
                f"{self.name}_VALUE": "VALUE",
            }
            self._namespaced_table = self.table.rename(new_column_names)
        return self._namespaced_table

    def _execute(self, tables: Dict[str, Table]):
        """
        Executes the phenotype processing logic.

        Args:
            tables (Dict[str, Table]): A dictionary where the keys are table names and the values are Table objects.

        Raises:
            NotImplementedError: This method should be implemented by subclasses.
        """
        raise NotImplementedError()

    def _check_for_children(self):
        for phenotype in self.children:
            if not isinstance(phenotype, Phenotype):
                raise ValueError("Dependent children must be of type Phenotype!")

    def __add__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "+")

    def __radd__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "+")

    def __sub__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "-")

    def __mul__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "*")

    def __rmul__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "*")

    def __truediv__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "/")

    def __and__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "&")

    def __or__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "|")

    def __invert__(self) -> "ComputationGraph":
        return ComputationGraph(self, None, "~")

    def get_codelists(self, to_pandas=False):
        codelists = []
        for child in self.children:
            codelists.extend(child.get_codelists())

        if to_pandas:
            import pandas as pd

            return pd.concat([x.to_pandas() for x in codelists]).drop_duplicates()
        return codelists


from typing import Dict, Union
from datetime import date
import ibis
from ibis.expr.types.relations import Table
from phenex.tables import PhenotypeTable, PHENOTYPE_TABLE_COLUMNS


class ComputationGraph:
    """
    ComputationGraph tracks arithmetic operations to be performed on two Phenotype objects.
    The actual execution of these operations is context-dependent and is handled by the
    responsible Phenotype class (ArithmeticPhenotype, ScorePhenotype, LogicPhenotype, etc.).
    """

    def __init__(
        self,
        left: Union["Phenotype", "ComputationGraph"],
        right: Union["Phenotype", "ComputationGraph", int, float, None],
        operator: str,
    ):
        self.table = None
        self.left = left
        self.right = right
        self.operator = operator
        self.children = (
            [left]
            if right is None or isinstance(right, (int, float))
            else [left, right]
        )

    def __add__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "+")

    def __radd__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "+")

    def __sub__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "-")

    def __mul__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "*")

    def __rmul__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "*")

    def __truediv__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "/")

    def __and__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "&")

    def __or__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "|")

    def __invert__(self) -> "ComputationGraph":
        return ComputationGraph(self, None, "~")

    def get_leaf_phenotypes(self):
        """
        A recursive function to extract all the leaf phenotypes from a computation graph.
        """

        def manage_node(node):
            if isinstance(node, ComputationGraph):
                return node.get_leaf_phenotypes()
            elif isinstance(node, Phenotype):
                return [node]
            return []

        phenotypes = []
        phenotypes.extend(manage_node(self.left))
        phenotypes.extend(manage_node(self.right))
        return phenotypes

    def get_value_expression(self, table, operate_on="boolean"):
        """
        A recursive function to build the full expression defined by a computation graph. A computation graph is a tree like structure with parents and children. The children can be either Phenotype objects, other ComputationGraph objects, or numerical values (int/float). The parents are the arithmetic operators that define the relationship between the children. This function recursively builds the expression by calling itself on the children and then applying the operator to the results.

        Args:
            table (Table): The table on which the value_expression is to be executed on. This must be the joined table that contains all the phenotypes contained within the computation graph.
            operate_on (str): Either 'boolean' or 'value', depending on whether the expression is to be evaluated using the phenotype boolean columns or value columns. See the comparison of composite phenotypes for more information.
        """

        def manage_node(node):
            if isinstance(node, ComputationGraph):
                return node.get_value_expression(table, operate_on)
            elif isinstance(node, Phenotype):
                if operate_on == "boolean":
                    return table[f"{node.name}_BOOLEAN"]
                return table[f"{node.name}_VALUE"]
            return node

        left = manage_node(self.left)
        right = manage_node(self.right)
        if self.operator == "+":
            return left + right
        elif self.operator == "-":
            return left - right
        elif self.operator == "*":
            return left * right
        elif self.operator == "/":
            return left / right
        else:
            raise ValueError(f"Operator {self.operator} not supported.")

    def get_boolean_expression(self, table, operate_on="boolean"):
        def manage_node(node):
            if isinstance(node, ComputationGraph):
                return node.get_boolean_expression(table, operate_on)
            elif isinstance(node, Phenotype):
                if operate_on == "boolean":
                    return table[f"{node.name}_BOOLEAN"]
                return table[f"{node.name}_VALUE"]
            return node

        left = manage_node(self.left)
        right = manage_node(self.right)

        if self.operator == "|":
            return left | right
        elif self.operator == "&":
            return left & right
        elif self.operator == "~":
            return ~(left)
        else:
            raise ValueError(f"Operator {self.operator} not supported.")

    def get_str(self):
        def manage_node(node):
            if isinstance(node, ComputationGraph):
                return node.get_str()
            elif isinstance(node, Phenotype):
                return node.name
            return str(node)

        left = manage_node(self.left)
        right = manage_node(self.right)
        return f"({left} {self.operator} {right})"

    def __str__(self):
        return self.get_str()
