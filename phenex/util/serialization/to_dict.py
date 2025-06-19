import inspect
from datetime import date, datetime


def to_dict(obj) -> dict:
    """
    This Function is used to serialize PhenEx objects into a format that can be easily stored or transmitted.
    Given a PhenEx object, it will return a dictionary with the class name and its parameters.
    This method runs recursively on all parameters of a PhenEx object.

    PhenEx classes generally have their own to_dict method. Those class methods call this method.
    Generally users are recommended to use the class methods instead of this method.
    This method is used internally by the class methods and by the PhenEx JSON-like serialization methods.
    """

    init_params = get_phenex_init_params(obj.__class__)
    _dict = {"class_name": obj.__class__.__name__}
    for param in init_params:
        if param != "self":
            value = getattr(obj, param, None)
            if isinstance(value, list):
                _dict[param] = [
                    (
                        item.to_dict()
                        if hasattr(item, "to_dict") and callable(item.to_dict)
                        else item
                    )
                    for item in value
                ]
            elif hasattr(value, "to_dict") and callable(value.to_dict):
                _dict[param] = value.to_dict()
            elif isinstance(value, (date, datetime)):
                _dict[param] = {"__datetime__": value.isoformat()}
            else:
                _dict[param] = value

    _dict.pop("kwargs", None)

    return _dict


def get_phenex_init_params(cls) -> dict:
    """
    Get all initialization parameters used to construct a PhenEx class.
    """
    params = {}
    if cls.__module__.startswith("phenex"):
        for base in cls.__bases__:
            params.update(get_phenex_init_params(base))
        params.update(inspect.signature(cls.__init__).parameters)
    return params
