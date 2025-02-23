import json as pyjson
from .to_dict import to_dict
from .from_dict import from_dict


def dump(obj, fp, **kwargs):
    """
    Serialize PhenEx objects as a JSON formatted stream to `fp` (a `.write()`-supporting file-like object).

    Example:
    ```python
    from phenex.codelists import Codelist
    from phenex.phenotypes import CodelistPhenotype
    import phenex.util.serialization.json as pxjson


    # Initialize with a list
    cl = Codelist(
        ['x', 'y', 'z'],
        'mycodelist'
    )
    entry = CodelistPhenotype(
        return_date="first",
        codelist=cl,
        domain="DRUG_EXPOSURE",
        date_range=study_period,
    )

    cohort = Cohort(
        entry=entry
    )

    PATH = ''

    # serialize the phenex object to file
    with open(PATH, "w") as f:
        pxjson.dump(cohort, f, indent=4)
    ```

    """
    pyjson.dump(obj.to_dict(), fp, **kwargs)


def dumps(obj, **kwargs):
    """
    Serialize a PhenEx object to a JSON formatted `str`.
    """
    return pyjson.dumps(to_dict(obj), **kwargs)


def load(fp, **kwargs):
    """
    Deserialize `fp` (a `.read()`-supporting file-like object containing a JSON document) to a PhenEx object.

    Example:
    ```python
    PATH = ''
    # serialize the phenex object to file
    with open(PATH, "r") as f:
        cohort = pxjson.load(f)
    ```
    """
    data = pyjson.load(fp, **kwargs)
    return from_dict(data)


def loads(s, **kwargs):
    """
    Deserialize `s` (a `str`, `bytes` or `bytearray` instance containing a JSON document) to a PhenEx object.
    """
    data = pyjson.loads(s, **kwargs)
    return from_dict(data)
