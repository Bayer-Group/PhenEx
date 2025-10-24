from typing import Dict, Union, Optional
from datetime import date
from ibis.expr.types.relations import Table
import ibis
from phenex.tables import PhenotypeTable, PHENOTYPE_TABLE_COLUMNS
from phenex.phenotypes.phenotype import Phenotype, ComputationGraph
from phenex.phenotypes.functions import hstack
from phenex.phenotypes.functions import select_phenotype_columns


class ComputationGraphPhenotype(Phenotype):
    """
    ComputationGraphPhenotypes are a type of CompositePhenotype that performs computations using phenotypes. The ComputationGraphPhenotype is a base class and must be subclassed.
    The subclasses of ComputationGraphPhenotype differ depending on which columns of the component phenotype tables are used as input and where the output is placed in the output phenotype table. The two options for both input and output are 'boolean' or 'value'.

    ## Comparison table of CompositePhenotype classes
    +---------------------+-------------+------------+
    |                     | Operates on | Populates  |
    +=====================+=============+============+
    | ArithmeticPhenotype | value       | value      |
    +---------------------+-------------+------------+
    | LogicPhenotype      | boolean     | boolean    |
    +---------------------+-------------+------------+
    | ScorePhenotype      | boolean     | value      |
    +---------------------+-------------+------------+

    Parameters:
        expression: The arithmetic expression to be evaluated composed of phenotypes combined by python arithmetic operations.
        return_date: The date to be returned for the phenotype. Can be "first", "last", or a Phenotype object.
        operate_on: The column to operate on. Can be "boolean" or "value".
        populate: The column to populate. Can be "boolean" or "value".
        reduce: Whether to reduce the phenotype table to only include rows where the boolean column is True. This is only relevant if populate is "boolean".

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)
    """

    def __init__(
        self,
        expression: ComputationGraph,
        return_date: Union[str, Phenotype],
        name: Optional[str] = None,
        aggregation_index=["PERSON_ID"],
        operate_on: str = "boolean",
        populate: str = "value",
        reduce: bool = False,
        **kwargs,
    ):
        if name is None:
            name = str(expression)
        super(ComputationGraphPhenotype, self).__init__(name=name, **kwargs)
        self.expression = expression
        self.return_date = return_date
        self.aggregation_index = aggregation_index
        self.operate_on = operate_on
        self.populate = populate
        self.reduce = reduce
        self.add_children(self.expression.get_leaf_phenotypes())

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        """
        Executes the score phenotype processing logic.

        Args:
            tables (Dict[str, Table]): A dictionary where the keys are table names and the values are Table objects.

        Returns:
            PhenotypeTable: The resulting phenotype table containing the required columns.
        """
        joined_table = hstack(self.children, tables["PERSON"].select("PERSON_ID"))

        if self.populate == "value" and self.operate_on == "boolean":
            for child in self.children:
                column_name = f"{child.name}_BOOLEAN"
                mutated_column = ibis.ifelse(
                    joined_table[column_name].isnull(),
                    0,
                    joined_table[column_name].cast("int"),
                ).cast("float")

                joined_table = joined_table.mutate(**{column_name: mutated_column})

        if self.populate == "value":
            _expression = self.expression.get_value_expression(
                joined_table, operate_on=self.operate_on
            )
            joined_table = joined_table.mutate(VALUE=_expression)
            # Arithmetic operations imply a boolean 'and' of children i.e. child1 + child two implies child1 and child2. if there are any null values in value calculations this is because one of the children is null, so we filter them out as the implied boolean condition is not met.
            joined_table = joined_table.filter(joined_table["VALUE"].notnull())

        elif self.populate == "boolean":
            _expression = self.expression.get_boolean_expression(
                joined_table, operate_on=self.operate_on
            )
            joined_table = joined_table.mutate(BOOLEAN=_expression)

        # Return the first or last event date
        date_columns = self._coalesce_all_date_columns(joined_table)
        if self.return_date == "first":
            joined_table = joined_table.mutate(EVENT_DATE=ibis.least(*date_columns))
        elif self.return_date == "last":
            joined_table = joined_table.mutate(EVENT_DATE=ibis.greatest(*date_columns))
        elif self.return_date == "all":
            joined_table = self._return_all_dates(joined_table, date_columns)
        elif isinstance(self.return_date, Phenotype):
            joined_table = joined_table.mutate(
                EVENT_DATE=getattr(joined_table, f"{self.return_date.name}_EVENT_DATE")
            )
        else:
            joined_table = joined_table.mutate(EVENT_DATE=ibis.null(date))

        # Reduce the table to only include rows where the boolean column is True
        if self.reduce:
            joined_table = joined_table.filter(joined_table.BOOLEAN == True)

        # Add a null value column if it doesn't exist, for example in the case of a LogicPhenotype
        schema = joined_table.schema()
        if "VALUE" not in schema.names:
            joined_table = joined_table.mutate(VALUE=ibis.null().cast("int32"))
        if "BOOLEAN" not in schema.names:
            joined_table = joined_table.mutate(BOOLEAN=ibis.null().cast("boolean"))

        return joined_table

    def _return_all_dates(self, table, date_columns):
        """
        If return date = all, we want to return all the dates on which phenotype criteria are fulfilled; this is a union of all the non-null dates in any leaf phenotype date columns.

        Args:
            table: The Ibis table object (e.g., joined_table) that contains all leaf phenotypes stacked horizontally
            date_columns: List of base columns as ibis objects

        Returns:
            Ibis expression representing the UNION of all non null dates.
        """
        # get all the non-null dates for each date column
        non_null_dates_by_date_col = []
        for date_col in date_columns:
            non_null_dates = table.filter(date_col.notnull()).mutate(
                EVENT_DATE=date_col
            )
            non_null_dates_by_date_col.append(non_null_dates)

        # do the union of all the non-null dates
        all_dates = non_null_dates_by_date_col[0]
        for non_null_dates in non_null_dates_by_date_col[1:]:
            all_dates = all_dates.union(non_null_dates)
        return all_dates

    def _coalesce_all_date_columns(self, table):
        """
        ComputationGraphPhenotypes have multiple possible date columns. To work with these date columns, which may be null, we perform a coalesce operation for each date column, which allows operations such as 'least' and 'greatest' to work correctly.

        Args:
            table: The Ibis table object (e.g., joined_table).

        Returns:
            Ibis expression representing the COALESCE of the columns.
        """
        coalesce_expressions = []

        names = [col for col in table.columns if "EVENT_DATE" in col]

        # computation graph phenotypes occasionally have a single phenotype in the expression e.g. negation of a single phenotype. In this case, some backends (e.g. Snowflake) do not work with coalesce of a single column. Therefore, if only a single phenotype, return the select of that column
        if len(names) == 1:
            return [table[names[0]]]

        # if more than one phenotype in expression, coalesce return date columns to allow for further date selection
        for i in range(len(names)):
            rotated_names = names[i:] + names[:i]
            coalesce_expr = ibis.coalesce(
                *(getattr(table, col) for col in rotated_names)
            )
            coalesce_expressions.append(coalesce_expr)

        return coalesce_expressions


class ScorePhenotype(ComputationGraphPhenotype):
    """
    ScorePhenotype is a CompositePhenotype that performs arithmetic operations using the **boolean** column of its component phenotypes and populations the **value** column. It should be used for calculating medical scores such as CHADSVASC, HASBLED, etc.

    --> See the comparison table of CompositePhenotype classes

    Parameters:
        expression: The arithmetic expression to be evaluated composed of phenotypes combined by python arithmetic operations.
        return_date: The date to be returned for the phenotype. Can be "first", "last", or a Phenotype object.
        name: The name of the phenotype.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Example:
    ```python
    # Create component phenotypes individually
    hypertension = Phenotype(Codelist('hypertension'))
    hf = Phenotype(Codelist('chf'))
    age_gt_45 = AgePhenotype(min_age=GreaterThan(45))

    # Create the ScorePhenotype that defines a score which is 2*age + 1 if
    # hypertension or chf are present, respectively. Notice that the boolean
    # column of the component phenotypes are used for calculation and the value
    # column is populated of the ScorePhenotype table.
    pt = ScorePhenotype(
        expression = 2 * age_gt_45 + hypertension + chf,
    )
    ```
    """

    def __init__(
        self,
        expression: ComputationGraph,
        return_date: Union[str, Phenotype] = "first",
        name: str = None,
        **kwargs,
    ):
        super(ScorePhenotype, self).__init__(
            name=name,
            expression=expression,
            return_date=return_date,
            operate_on="boolean",
            populate="value",
        )


class ArithmeticPhenotype(ComputationGraphPhenotype):
    """
    ArithmeticPhenotype is a composite phenotype that performs arithmetic operations using the **value** column of its component phenotypes and populations the **value** column. It should be used for calculating values such as BMI, GFR or converting units.
    --> See the comparison table of CompositePhenotype classes

    Parameters:
        expression: The arithmetic expression to be evaluated composed of phenotypes combined by python arithmetic operations.
        return_date: The date to be returned for the phenotype. Can be "first", "last", or a Phenotype object.
        name: The name of the phenotype.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Example:
    ```python
    # Create component phenotypes individually
    height = MeasurementPhenotype(Codelist('height'))
    weight = MeasurementPhenotype(Codelist('weight'))

    # Create the ArithmeticPhenotype that defines the BMI score
    bmi = ArithmeticPhenotype(
        expression = weight / height**2,
    )
    ```
    """

    def __init__(
        self,
        expression: ComputationGraph,
        return_date: Union[str, Phenotype] = "first",
        name: str = None,
        **kwargs,
    ):
        super(ArithmeticPhenotype, self).__init__(
            name=name,
            expression=expression,
            return_date=return_date,
            operate_on="value",
            populate="value",
        )


class LogicPhenotype(ComputationGraphPhenotype):
    """
    LogicPhenotype is a composite phenotype that performs boolean operations using the **boolean** column of its component phenotypes and populations the **boolean** column of the resulting phenotype table. It should be used in any instance where multiple phenotypes are logically combined, for example, does a patient have diabetes AND hypertension, etc.

    --> See the comparison table of CompositePhenotype classes

    Parameters:
        expression: The logical expression to be evaluated composed of phenotypes combined by python arithmetic operations.
        return_date: The date to be returned for the phenotype. Can be "first", "last", or a Phenotype object.
        name: The name of the phenotype.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)
    """

    def __init__(
        self,
        expression: ComputationGraph,
        return_date: Union[str, Phenotype] = "first",
        name: str = None,
        **kwargs,
    ):
        super(LogicPhenotype, self).__init__(
            name=name,
            expression=expression,
            return_date=return_date,
            operate_on="boolean",
            populate="boolean",
            reduce=True,
        )

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        """
        Executes the logic phenotype processing logic.
        Unlike the base class, LogicPhenotype populates both BOOLEAN and VALUE columns.
        The VALUE is taken from the phenotype whose date is selected based on return_date.

        Args:
            tables (Dict[str, Table]): A dictionary where the keys are table names and the values are Table objects.

        Returns:
            PhenotypeTable: The resulting phenotype table containing the required columns.
        """
        joined_table = hstack(self.children, tables["PERSON"].select("PERSON_ID"))

        # Convert boolean columns to integers for arithmetic operations if needed
        if self.populate == "value" and self.operate_on == "boolean":
            for child in self.children:
                column_name = f"{child.name}_BOOLEAN"
                mutated_column = ibis.ifelse(
                    joined_table[column_name].isnull(),
                    0,
                    joined_table[column_name].cast("int"),
                ).cast("float")
                joined_table = joined_table.mutate(**{column_name: mutated_column})

        # Populate the BOOLEAN column using the logical expression
        _boolean_expression = self.expression.get_boolean_expression(
            joined_table, operate_on=self.operate_on
        )
        joined_table = joined_table.mutate(BOOLEAN=_boolean_expression)

        # Get date columns for determining which phenotype's value to use
        date_columns = self._coalesce_all_date_columns(joined_table)

        # Handle the "all" case separately since it returns a Union table
        if self.return_date == "all":
            joined_table = self._return_all_dates_with_value(joined_table, date_columns)
        else:
            # Determine the selected date and corresponding value for non-"all" cases
            if self.return_date == "first":
                selected_date = ibis.least(*date_columns)
                joined_table = joined_table.mutate(EVENT_DATE=selected_date)
            elif self.return_date == "last":
                selected_date = ibis.greatest(*date_columns)
                joined_table = joined_table.mutate(EVENT_DATE=selected_date)
            elif isinstance(self.return_date, Phenotype):
                selected_date = getattr(
                    joined_table, f"{self.return_date.name}_EVENT_DATE"
                )
                joined_table = joined_table.mutate(EVENT_DATE=selected_date)
            else:
                selected_date = ibis.null(date)
                joined_table = joined_table.mutate(EVENT_DATE=selected_date)

            # Populate the VALUE column with the value from the phenotype whose date matches the selected date
            value_cases = []
            for child in self.children:
                child_date_col = f"{child.name}_EVENT_DATE"
                child_value_col = f"{child.name}_VALUE"

                # Check if this child's date matches the selected date
                condition = getattr(joined_table, child_date_col) == selected_date
                value_cases.append((condition, getattr(joined_table, child_value_col)))

            # Build the CASE expression: when date matches, use that phenotype's value
            if value_cases:
                selected_value = ibis.case()
                for condition, value in value_cases:
                    selected_value = selected_value.when(condition, value)
                selected_value = selected_value.else_(ibis.null()).end()
                joined_table = joined_table.mutate(VALUE=selected_value)
            else:
                joined_table = joined_table.mutate(VALUE=ibis.null().cast("int32"))

        # Reduce the table to only include rows where the boolean column is True
        if self.reduce:
            joined_table = joined_table.filter(joined_table.BOOLEAN == True)

        # Select only the required phenotype columns
        return select_phenotype_columns(joined_table)

    def _return_all_dates_with_value(self, table, date_columns):
        """
        Custom version of _return_all_dates that properly handles VALUE column for LogicPhenotype.
        For each date column, creates a separate table with the correct VALUE populated, then unions them.

        Args:
            table: The Ibis table object (e.g., joined_table) that contains all leaf phenotypes stacked horizontally
            date_columns: List of base columns as ibis objects

        Returns:
            Ibis expression representing the UNION of all non null dates with proper VALUE columns.
        """
        # get all the non-null dates for each date column and populate VALUE correctly
        non_null_dates_by_date_col = []
        for date_col in date_columns:
            # Filter for non-null dates
            non_null_dates = table.filter(date_col.notnull()).mutate(
                EVENT_DATE=date_col
            )

            # For this specific date, find which phenotype's value to use
            value_cases = []
            for child in self.children:
                child_date_col = f"{child.name}_EVENT_DATE"
                child_value_col = f"{child.name}_VALUE"

                # Check if this child's date matches the current date
                condition = getattr(non_null_dates, child_date_col) == date_col
                value_cases.append(
                    (condition, getattr(non_null_dates, child_value_col))
                )

            # Build the CASE expression for this date
            if value_cases:
                selected_value = ibis.case()
                for condition, value in value_cases:
                    selected_value = selected_value.when(condition, value)
                selected_value = selected_value.else_(ibis.null()).end()
                non_null_dates = non_null_dates.mutate(VALUE=selected_value)
            else:
                non_null_dates = non_null_dates.mutate(VALUE=ibis.null().cast("int32"))

            non_null_dates_by_date_col.append(non_null_dates)

        # do the union of all the non-null dates
        all_dates = non_null_dates_by_date_col[0]
        for non_null_dates in non_null_dates_by_date_col[1:]:
            all_dates = all_dates.union(non_null_dates)

        # Select only the required phenotype columns
        from phenex.phenotypes.functions import select_phenotype_columns

        return select_phenotype_columns(all_dates)
