from typing import Optional, TYPE_CHECKING
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger

if TYPE_CHECKING:
    from phenex.ibis_connect import (
        SnowflakeConnector,
        DuckDBConnector,
        PostgresConnector,
    )
    from phenex.mappers import DomainsDictionary
    from phenex.filters import DateFilter

logger = create_logger(__name__)


class Database:
    """
    A Database encapsulates the data source configuration including the database connector,
    domain mappings, and optional data period filtering.

    This abstraction provides a consistent way to specify data sources across the PhenEx API
    and enables serialization of cohort configurations without serializing the actual
    database connections.

    Parameters:
        connector: A database connector (SnowflakeConnector, DuckDBConnector, or PostgresConnector).
                  Note: The connector itself is not serialized. When deserializing, you must
                  provide a new connector instance or rely on environment variables for
                  connector initialization.
        mapper: A DomainsDictionary that maps source database tables to PhenEx domain tables.
        data_period: Optional DateFilter to restrict all input data to a specific date range.
                    The input data will be modified to look as if data outside the data_period
                    was never recorded before any phenotypes are computed.
        name: Optional descriptive name for this database configuration.

    Attributes:
        connector: The database connector instance.
        mapper: The domains dictionary for table mapping.
        data_period: The date filter for restricting data, if any.
        name: The descriptive name of this database configuration.

    Example:
        ```python
        from phenex.core import Database
        from phenex.ibis_connect import SnowflakeConnector
        from phenex.mappers import OMOPMapper
        from phenex.filters import After
        from datetime import date

        # Create a database configuration
        db = Database(
            connector=SnowflakeConnector(),
            mapper=OMOPMapper,
            name="production_omop_db"
        )

        # Use in cohort
        cohort = Cohort(
            name="my_cohort",
            entry_criterion=my_phenotype,
            database=db
        )
        ```
    """

    def __init__(
        self,
        connector: Optional[
            "SnowflakeConnector | DuckDBConnector | PostgresConnector"
        ] = None,
        mapper: Optional["DomainsDictionary"] = None,
        data_period: Optional["DateFilter"] = None,
        name: Optional[str] = None,
    ):
        """
        Initialize a Database configuration.

        Args:
            connector: Database connector for reading/writing data.
            mapper: DomainsDictionary for mapping tables to PhenEx domains.
            data_period: Optional date filter to restrict input data.
            name: Optional descriptive name for this database.
        """
        self.connector = connector
        self.mapper = mapper
        self.data_period = data_period
        self.name = name or "unnamed_database"

        logger.info(f"Database '{self.name}' initialized")

    def to_dict(self) -> dict:
        """
        Serialize the Database configuration to a dictionary.

        Note: The connector connection itself is NOT serialized as database connections
        cannot be serialized. However, configuration parameters (source database, warehouse,
        account, etc.) ARE serialized so the connector can be reconstructed.
        Sensitive credentials (passwords, usernames) are excluded from serialization.

        Returns:
            dict: Serialized representation of the Database configuration.
        """
        result = to_dict(self)

        # Replace the actual connector with metadata and configuration
        # This allows reconstruction without serializing the connection
        if self.connector is not None:
            connector_class_name = self.connector.__class__.__name__
            connector_config = {
                "__connector_type__": connector_class_name,
            }

            # Extract non-sensitive configuration parameters based on connector type
            if connector_class_name == "SnowflakeConnector":
                # Store Snowflake config except sensitive credentials #TODO eventually harmonize parameter names
                connector_config.update(
                    {
                        "SNOWFLAKE_ACCOUNT": getattr(
                            self.connector, "SNOWFLAKE_ACCOUNT", None
                        ),
                        "SNOWFLAKE_WAREHOUSE": getattr(
                            self.connector, "SNOWFLAKE_WAREHOUSE", None
                        ),
                        "SNOWFLAKE_ROLE": getattr(
                            self.connector, "SNOWFLAKE_ROLE", None
                        ),
                        "SNOWFLAKE_SOURCE_DATABASE": getattr(
                            self.connector, "SNOWFLAKE_SOURCE_DATABASE", None
                        ),
                        "SNOWFLAKE_DEST_DATABASE": getattr(
                            self.connector, "SNOWFLAKE_DEST_DATABASE", None
                        ),
                        # Explicitly exclude: SNOWFLAKE_USER, SNOWFLAKE_PASSWORD
                    }
                )
            elif connector_class_name == "DuckDBConnector":
                # Store DuckDB config (no sensitive data in DuckDB connector)
                connector_config.update(
                    {
                        "DUCKDB_SOURCE_DATABASE": getattr(
                            self.connector, "DUCKDB_SOURCE_DATABASE", None
                        ),
                        "DUCKDB_DEST_DATABASE": getattr(
                            self.connector, "DUCKDB_DEST_DATABASE", None
                        ),
                    }
                )
            elif connector_class_name == "PostgresConnector":
                # Store PostgreSQL config except sensitive credentials
                connector_config.update(
                    {
                        "POSTGRES_HOST": getattr(self.connector, "POSTGRES_HOST", None),
                        "POSTGRES_PORT": getattr(self.connector, "POSTGRES_PORT", None),
                        "POSTGRES_SOURCE_DATABASE": getattr(
                            self.connector, "POSTGRES_SOURCE_DATABASE", None
                        ),
                        "POSTGRES_SOURCE_SCHEMA": getattr(
                            self.connector, "POSTGRES_SOURCE_SCHEMA", None
                        ),
                        "POSTGRES_DEST_DATABASE": getattr(
                            self.connector, "POSTGRES_DEST_DATABASE", None
                        ),
                        "POSTGRES_DEST_SCHEMA": getattr(
                            self.connector, "POSTGRES_DEST_SCHEMA", None
                        ),
                        # Explicitly exclude: POSTGRES_USER, POSTGRES_PASSWORD
                    }
                )

            result["connector"] = connector_config

        return result

    def __repr__(self) -> str:
        """String representation of the Database."""
        connector_type = type(self.connector).__name__ if self.connector else "None"
        mapper_type = type(self.mapper).__name__ if self.mapper else "None"
        data_period_str = str(self.data_period) if self.data_period else "None"

        return (
            f"Database(name='{self.name}', "
            f"connector={connector_type}, "
            f"mapper={mapper_type}, "
            f"data_period={data_period_str})"
        )

    def validate(self) -> None:
        """
        Validate that the Database configuration is complete and consistent.

        Raises:
            ValueError: If the configuration is invalid.
        """
        if self.connector is None and self.mapper is None:
            logger.warning(
                f"Database '{self.name}' has no connector or mapper defined. "
                "This may be intentional for testing or may indicate an incomplete configuration."
            )

        if (self.connector is None) != (self.mapper is None):
            raise ValueError(
                f"Database '{self.name}': Both 'connector' and 'mapper' must be defined together, or both must be None. "
                f"Got connector={'defined' if self.connector is not None else 'None'}, "
                f"mapper={'defined' if self.mapper is not None else 'None'}"
            )

        logger.debug(f"Database '{self.name}' validation passed")
