import json as pyjson
from .to_dict import to_dict
from .from_dict import from_dict

def dump(obj, fp, **kwargs):
    """
    Serialize `obj` as a JSON formatted stream to `fp` (a `.write()`-supporting file-like object).
    """
    pyjson.dump(to_dict(obj), fp, **kwargs)

def dumps(obj, **kwargs):
    """
    Serialize `obj` to a JSON formatted `str`.
    """
    return pyjson.dumps(to_dict(obj), **kwargs)

def load(fp, **kwargs):
    """
    Deserialize `fp` (a `.read()`-supporting file-like object containing a JSON document) to a Python object.
    """
    data = pyjson.load(fp, **kwargs)
    return from_dict(data)

def loads(s, **kwargs):
    """
    Deserialize `s` (a `str`, `bytes` or `bytearray` instance containing a JSON document) to a Python object.
    """
    data = pyjson.loads(s, **kwargs)
    return from_dict(data)