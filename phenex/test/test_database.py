"""
Tests for the Database class.
"""

import pytest
from phenex.core.database import Database
from phenex.filters import After, Before
from phenex.mappers import OMOPDomains
from datetime import date
import json


class MockConnector:
    """Mock connector for testing."""

    pass


class MockSnowflakeConnector:
    """Mock Snowflake connector for testing serialization."""

    def __init__(self):
        self.SNOWFLAKE_ACCOUNT = "test_account"
        self.SNOWFLAKE_WAREHOUSE = "test_warehouse"
        self.SNOWFLAKE_ROLE = "test_role"
        self.SNOWFLAKE_SOURCE_DATABASE = "SOURCE_DB.SCHEMA"
        self.SNOWFLAKE_DEST_DATABASE = "DEST_DB.SCHEMA"
        self.SNOWFLAKE_USER = "test_user"
        self.SNOWFLAKE_PASSWORD = "secret_password"


class MockDuckDBConnector:
    """Mock DuckDB connector for testing serialization."""

    def __init__(self):
        self.DUCKDB_SOURCE_DATABASE = "/path/to/source.duckdb"
        self.DUCKDB_DEST_DATABASE = "/path/to/dest.duckdb"


class MockPostgresConnector:
    """Mock PostgreSQL connector for testing serialization."""

    def __init__(self):
        self.POSTGRES_HOST = "localhost"
        self.POSTGRES_PORT = 5432
        self.POSTGRES_SOURCE_DATABASE = "source_db"
        self.POSTGRES_SOURCE_SCHEMA = "public"
        self.POSTGRES_DEST_DATABASE = "dest_db"
        self.POSTGRES_DEST_SCHEMA = "staging"
        self.POSTGRES_USER = "test_user"
        self.POSTGRES_PASSWORD = "secret_password"


class MockMapper:
    """Mock mapper for testing."""

    def to_dict(self):
        """Mock serialization for testing."""
        return {"class_name": "DomainsDictionary", "domains_dict": {}}


def test_database_init():
    """Test basic Database initialization."""
    connector = MockConnector()
    mapper = MockMapper()
    data_period = After(date(2020, 1, 1))

    db = Database(
        connector=connector, mapper=mapper, data_period=data_period, name="test_db"
    )

    assert db.connector is connector
    assert db.mapper is mapper
    assert db.data_period is data_period
    assert db.name == "test_db"


def test_database_validation_both_none():
    """Test that validation passes when both connector and mapper are None."""
    db = Database(name="empty_db")
    # Should log a warning but not raise an error
    db.validate()


def test_database_validation_only_connector():
    """Test that validation fails when only connector is provided."""
    connector = MockConnector()
    db = Database(connector=connector, name="invalid_db")

    with pytest.raises(
        ValueError, match="Both 'connector' and 'mapper' must be defined together"
    ):
        db.validate()


def test_database_validation_only_mapper():
    """Test that validation fails when only mapper is provided."""
    mapper = MockMapper()
    db = Database(mapper=mapper, name="invalid_db")

    with pytest.raises(
        ValueError, match="Both 'connector' and 'mapper' must be defined together"
    ):
        db.validate()


def test_database_validation_both_defined():
    """Test that validation passes when both connector and mapper are defined."""
    connector = MockConnector()
    mapper = MockMapper()
    db = Database(connector=connector, mapper=mapper, name="valid_db")

    # Should not raise
    db.validate()


def test_database_repr():
    """Test string representation of Database."""
    connector = MockConnector()
    mapper = MockMapper()
    data_period = After(date(2020, 1, 1))

    db = Database(
        connector=connector, mapper=mapper, data_period=data_period, name="test_db"
    )

    repr_str = repr(db)
    assert "test_db" in repr_str
    assert "MockConnector" in repr_str
    assert "MockMapper" in repr_str


def test_database_serialization():
    """Test that Database can be serialized to dict."""
    connector = MockConnector()
    mapper = MockMapper()
    data_period = After(date(2020, 1, 1))

    db = Database(
        connector=connector, mapper=mapper, data_period=data_period, name="test_db"
    )

    serialized = db.to_dict()

    assert serialized["class_name"] == "Database"
    assert serialized["name"] == "test_db"
    assert "__connector_type__" in serialized["connector"]
    assert serialized["connector"]["__connector_type__"] == "MockConnector"
    # data_period should be serialized as well
    assert "class_name" in serialized["data_period"]


def test_snowflake_connector_serialization():
    """Test that SnowflakeConnector config is properly serialized."""
    connector = MockSnowflakeConnector()
    mapper = MockMapper()

    db = Database(connector=connector, mapper=OMOPDomains, name="snowflake_db")

    serialized = db.to_dict()

    # Check connector type
    assert serialized["connector"]["__connector_type__"] == "MockSnowflakeConnector"
    print(serialized)

    # Check that non-sensitive parameters are included
    assert serialized["connector"]["SNOWFLAKE_ACCOUNT"] == "test_account"
    assert serialized["connector"]["SNOWFLAKE_WAREHOUSE"] == "test_warehouse"
    assert serialized["connector"]["SNOWFLAKE_ROLE"] == "test_role"
    assert serialized["connector"]["SNOWFLAKE_SOURCE_DATABASE"] == "SOURCE_DB.SCHEMA"
    assert serialized["connector"]["SNOWFLAKE_DEST_DATABASE"] == "DEST_DB.SCHEMA"

    # Check that sensitive parameters are NOT included
    assert "SNOWFLAKE_USER" not in serialized["connector"]
    assert "SNOWFLAKE_PASSWORD" not in serialized["connector"]


def test_duckdb_connector_serialization():
    """Test that DuckDBConnector config is properly serialized."""
    connector = MockDuckDBConnector()
    mapper = MockMapper()

    db = Database(connector=connector, mapper=mapper, name="duckdb_db")

    serialized = db.to_dict()

    # Check connector type
    assert serialized["connector"]["__connector_type__"] == "MockDuckDBConnector"

    # Check that parameters are included
    assert serialized["connector"]["DUCKDB_SOURCE_DATABASE"] == "/path/to/source.duckdb"
    assert serialized["connector"]["DUCKDB_DEST_DATABASE"] == "/path/to/dest.duckdb"


def test_postgres_connector_serialization():
    """Test that PostgresConnector config is properly serialized."""
    connector = MockPostgresConnector()
    mapper = MockMapper()

    db = Database(connector=connector, mapper=mapper, name="postgres_db")

    serialized = db.to_dict()

    # Check connector type
    assert serialized["connector"]["__connector_type__"] == "MockPostgresConnector"

    # Check that non-sensitive parameters are included
    assert serialized["connector"]["POSTGRES_HOST"] == "localhost"
    assert serialized["connector"]["POSTGRES_PORT"] == 5432
    assert serialized["connector"]["POSTGRES_SOURCE_DATABASE"] == "source_db"
    assert serialized["connector"]["POSTGRES_SOURCE_SCHEMA"] == "public"
    assert serialized["connector"]["POSTGRES_DEST_DATABASE"] == "dest_db"
    assert serialized["connector"]["POSTGRES_DEST_SCHEMA"] == "staging"

    # Check that sensitive parameters are NOT included
    assert "POSTGRES_USER" not in serialized["connector"]
    assert "POSTGRES_PASSWORD" not in serialized["connector"]

    serialized = db.to_dict()

    assert serialized["class_name"] == "Database"
    assert serialized["name"] == "postgres_db"
    assert "__connector_type__" in serialized["connector"]


def test_database_default_name():
    """Test that Database gets a default name if none provided."""
    db = Database()
    assert db.name == "unnamed_database"


def test_database_with_only_data_period():
    """Test Database with only data_period (no connector/mapper)."""
    data_period = Before(date(2023, 12, 31))
    db = Database(data_period=data_period, name="data_period_only")

    assert db.connector is None
    assert db.mapper is None
    assert db.data_period is data_period

    # Should validate (with warning)
    db.validate()


if __name__ == "__main__":
    test_database_with_only_data_period()
    test_database_default_name()
    test_snowflake_connector_serialization()
    test_postgres_connector_serialization()
    # pytest.main([__file__])
