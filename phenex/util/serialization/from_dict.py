from datetime import datetime
from phenex.aggregators import *
from phenex.codelists import *
from phenex.phenotypes import *
from phenex.phenotypes.phenotype import ComputationGraph
from phenex.phenotypes.computation_graph_phenotypes import ComputationGraphPhenotype
from phenex.core import *
from phenex.core.reporter_nodes import Reporter as ReporterNode, Table1Node, Table1OutcomesNode, WaterfallNode, CustomReporterNode
from phenex.filters import *
from phenex.derived_tables import *
from phenex.reporting import *
from phenex.mappers import DomainsDictionary
from phenex.tables import PhenexTable, PhenexPersonTable, EventTable, CodeTable, PhenexVisitOccurrenceTable, PhenexIndexTable, PhenexObservationPeriodTable, MeasurementTable, PhenotypeTable
import inspect
from phenex.util import create_logger
from phenex.util.serialization.to_dict import get_phenex_init_params

logger = create_logger(__name__)


def from_dict(data: dict):
    """
    Method to decode all PhenEx classes. Given encoded PhenEx data, it will return the corresponding PhenEx class.
    """
    # logger.debug(f"Decoding data: {data}")

    class_name = data.get("class_name")
    if class_name is None:
        raise ValueError(
            f"Cannot deserialize: 'class_name' key is missing or None in data. "
            f"Available keys: {list(data.keys())}"
        )

    # Special handling for DomainsDictionary
    if class_name == "DomainsDictionary":
        return DomainsDictionary.from_dict(data)

    data.pop("class_name", None)
    # logger.debug(f"Class name: {class_name}")
    cls = globals()[class_name]
    all_params = get_phenex_init_params(cls)
    # logger.debug(f"Current params: {all_params}")

    init_args = {}
    kwargs = {}
    for param in all_params:
        if param == "kwargs":
            continue
        if param != "self":
            value = data.get(param)
            param_type = all_params[param].annotation
            # logger.debug(f"Processing param: {param}, value: {value}, type: {param_type}")
            if value is None:
                init_args[param] = None
            elif isinstance(value, dict) and "__connector_type__" in value:
                # Handle connector reconstruction with stored configuration
                connector_type = value["__connector_type__"]
                logger.info(
                    f"Reconstructing connector of type '{connector_type}' from stored configuration. "
                    "Credentials (username/password) will be loaded from environment variables."
                )

                # Import connector classes
                from phenex.ibis_connect import (
                    SnowflakeConnector,
                    DuckDBConnector,
                    PostgresConnector,
                )

                # Reconstruct the connector with stored config
                # Credentials will be loaded from environment variables
                connector = None
                try:
                    if "Snowflake" in connector_type:
                        connector = SnowflakeConnector(
                            SNOWFLAKE_ACCOUNT=value.get("SNOWFLAKE_ACCOUNT"),
                            SNOWFLAKE_WAREHOUSE=value.get("SNOWFLAKE_WAREHOUSE"),
                            SNOWFLAKE_ROLE=value.get("SNOWFLAKE_ROLE"),
                            SNOWFLAKE_SOURCE_DATABASE=value.get(
                                "SNOWFLAKE_SOURCE_DATABASE"
                            ),
                            SNOWFLAKE_DEST_DATABASE=value.get("SNOWFLAKE_DEST_DATABASE"),
                            # SNOWFLAKE_USER and SNOWFLAKE_PASSWORD will be loaded from env vars
                        )
                    elif "DuckDB" in connector_type:
                        connector = DuckDBConnector(
                            DUCKDB_SOURCE_DATABASE=value.get("DUCKDB_SOURCE_DATABASE"),
                            DUCKDB_DEST_DATABASE=value.get("DUCKDB_DEST_DATABASE"),
                        )
                    elif "Postgres" in connector_type:
                        connector = PostgresConnector(
                            POSTGRES_HOST=value.get("POSTGRES_HOST"),
                            POSTGRES_PORT=value.get("POSTGRES_PORT"),
                            POSTGRES_SOURCE_DATABASE=value.get("POSTGRES_SOURCE_DATABASE"),
                            POSTGRES_SOURCE_SCHEMA=value.get("POSTGRES_SOURCE_SCHEMA"),
                            POSTGRES_DEST_DATABASE=value.get("POSTGRES_DEST_DATABASE"),
                            POSTGRES_DEST_SCHEMA=value.get("POSTGRES_DEST_SCHEMA"),
                            # POSTGRES_USER and POSTGRES_PASSWORD will be loaded from env vars
                        )
                    else:
                        logger.warning(
                            f"Unknown connector type '{connector_type}'. "
                            "Connector will be set to None. You must provide it manually."
                        )
                except (ValueError, Exception) as e:
                    logger.warning(
                        f"Could not reconstruct connector of type '{connector_type}': {e}. "
                        "Connector will be set to None. You must provide it manually before executing."
                    )

                init_args[param] = connector
            elif isinstance(value, list):
                init_args[param] = [
                    (
                        from_dict(item)
                        if isinstance(item, dict) and "class_name" in item.keys()
                        else item
                    )
                    for item in value
                ]
            elif isinstance(value, dict) and "__datetime__" in value:
                init_args[param] = datetime.fromisoformat(value["__datetime__"]).date()
            elif isinstance(value, dict) and "class_name" in value.keys():
                init_args[param] = from_dict(value)
            elif isinstance(value, dict):
                init_args[param] = convert_null_keys_to_none_in_dictionary(value)
            else:
                init_args[param] = value

    # logger.debug(f"Init args: {init_args}")
    # logger.debug(f"Kwargs: {kwargs}")
    if len(kwargs.keys()) > 0:
        return cls(**init_args)
    return cls(**init_args)


def convert_null_keys_to_none_in_dictionary(_dict):
    """
    Given a dictionary with strings 'null' as keys, replaces the 'null' string key with a python NoneType this is required because Codelists are implemented as a dictionary with keys = code_type and If code_type is not defined the key is None (in python) and null in json
    """
    new_dict = {}
    for k, v in _dict.items():
        if k == "null":
            new_key = None
        else:
            new_key = k
        new_dict[new_key] = v
    return new_dict
