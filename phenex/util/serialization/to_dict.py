import inspect
from datetime import date


def to_dict(obj) -> dict:
    init_params = inspect.signature(obj.__init__).parameters
    _dict = {"class_name": obj.__class__.__name__}
    for param in init_params:
        if param != "self":
            value = getattr(obj, param)
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
            elif isinstance(value, date):
                _dict[param] = {"__datetime__": value.isoformat()}
            else:
                _dict[param] = value
    return _dict
