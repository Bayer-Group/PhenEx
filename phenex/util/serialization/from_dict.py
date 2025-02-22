from phenex.codelists import *
from phenex.phenotypes import *
from phenex.filters import *
import inspect

def from_dict(data: dict):
    """
    Create an instance from a dictionary.
    """
    class_name = data.pop('class_name')
    cls = globals()[class_name]
    init_params = inspect.signature(cls.__init__).parameters
    init_args = {}
    for param in init_params:
        if param != 'self':
            value = data.get(param)
            param_type = init_params[param].annotation
            if isinstance(value, list):
                init_args[param] = [
                    from_dict(item) if isinstance(item,dict) and 'class_name' in item.keys() else item
                    for item in value
                ]
            elif isinstance(value, dict) and 'class_name' in value.keys():
                init_args[param] = from_dict(value)
            else:
                init_args[param] = value
    return cls(**init_args)