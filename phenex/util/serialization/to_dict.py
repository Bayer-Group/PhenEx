import inspect
from datetime import date, datetime

def to_dict(obj) -> dict:
    """
    Serialize a PhenEx object into a dictionary format.

    This function converts a PhenEx object into a dictionary that includes the class name and its attributes. It handles nested objects, lists of objects, and date/datetime attributes. This method is recursive and processes all parameters of a PhenEx object.

    PhenEx classes generally have their own `to_dict` method, which internally calls this function. Users are encouraged to use the `to_dict` method of the PhenEx classes instead of directly calling this function.

    Returns:
        dict: A dictionary representation of the object.

    Serialization Keys:
        - `class_name`: The name of the object's class.
        - Other keys correspond to the parameters of the class's `__init__` method.

    Special Handling:
        - Lists: Each item in the list is serialized if it has a `to_dict` method.
        - Nested Objects: Calls the `to_dict` method of the nested object if available.
        - Dates/Datetimes: Converted to ISO 8601 string format and wrapped in a dictionary
          with the key `__datetime__`.

    Example:
        ```python
        from datetime import datetime
        class Example:
            def __init__(self, name, timestamp):
                self.name = name
                self.timestamp = timestamp

            def to_dict(self):
                return to_dict(self)

        obj = Example("Sample", datetime.now())
        print(obj.to_dict())
        ```
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
