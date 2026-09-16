from typing import Callable, Dict
import inspect
import textwrap


def serialize_function(function: Callable) -> str:
    """
    Serialize a user defined function to its source code as a string.
    """
    try:
        source = inspect.getsource(function)
    except (OSError, TypeError) as e:
        raise ValueError(
            "Could not serialize the given function. The function must be defined "
            f"such that its source code is retrievable (not a lambda or an "
            f"interactively defined function): {e}"
        )
    return textwrap.dedent(source)


def deserialize_function(function_string: str) -> Callable:
    """
    Reconstruct a callable from source code stored as a string.
    """
    namespace: Dict[str, object] = {}
    exec(function_string, namespace)
    functions = [
        value
        for key, value in namespace.items()
        if callable(value) and not key.startswith("__")
    ]
    if not functions:
        raise ValueError(
            "function_string did not define any callable."
        )
    return functions[-1]
