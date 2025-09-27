from datetime import datetime
from phenex.codelists import *
from phenex.phenotypes import *
from phenex.phenotypes.phenotype import ComputationGraph
from phenex.filters import *
import inspect
from phenex.util import create_logger
from phenex.util.serialization.to_dict import get_phenex_init_params

logger = create_logger(__name__)


def from_dict(data: dict):
    """
    Method to decode all PhenEx classes. Given encoded PhenEx data, it will return the corresponding PhenEx class.
    """
    # logger.debug(f"Decoding data: {data}")

    class_name = data.pop("class_name")
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
