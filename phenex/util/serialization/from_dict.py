from datetime import datetime
from phenex.codelists import *
from phenex.phenotypes import *
from phenex.filters import *
import inspect


def from_dict(data: dict):
    """
    Method to decode all PhenEx classes. Given encoded PhenEx data, it will return the corresponding PhenEx class.
    """
    class_name = data.pop("class_name")
    cls = globals()[class_name]
    init_params = inspect.signature(cls.__init__).parameters
    init_args = {}
    for param in init_params:
        if param != "self":
            value = data.get(param)
            param_type = init_params[param].annotation
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
                init_args[param] = datetime.fromisoformat(value["__datetime__"])
            elif isinstance(value, dict) and "class_name" in value.keys():
                init_args[param] = from_dict(value)
            elif isinstance(value, dict):
                init_args[param] = convert_null_keys_to_none_in_dictionary(value)
            else:
                init_args[param] = value
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
