from phenex.util.serialization.to_dict import get_phenex_init_params
from phenex.phenotypes import *
from phenex.filters import *
from phenex.codelists import *
from typing import get_type_hints, Optional, Union, List, Dict, ForwardRef
import inspect


def create_call_signature_info_dict_for_all_phenex_classes(path=None) -> dict:
    """
    Create a dictionary containing call signature information for all PhenEx classes.
    - keys are the PhenEx class names
    - values : a list of dictionaries with keys param, default, type, required
    The dictionary is saved to a JSON file if a path is provided.
    Parameters:
    path (str, optional): The path to save the JSON file. If None, the dictionary is not saved.
    Returns:
    dict: A dictionary containing call signature information for all PhenEx classes.
    """
    phenotypes = [
        CodelistPhenotype,
        AgePhenotype,
        SexPhenotype,
        MultipleOccurrencesPhenotype,
        MeasurementPhenotype,
        DeathPhenotype,
        CategoricalPhenotype,
        ContinuousCoveragePhenotype,
        ScorePhenotype,
        ArithmeticPhenotype,
        LogicPhenotype,
    ]

    filters = [
        GreaterThan,
        GreaterThanOrEqualTo,
        LessThan,
        LessThanOrEqualTo,
        EqualTo,
        Value,
        CategoricalFilter,
        CodelistFilter,
        DateRangeFilter,
        RelativeTimeRangeFilter,
        ValueFilter,
    ]
    codelists = [Codelist]

    all_classes = phenotypes + filters + codelists
    infos = create_call_signature_info_dict_for_classes(all_classes)

    if path is not None:
        import json

        with open(path, "w") as f:
            json.dump(infos, f, indent=4)


def create_call_signature_info_dict_for_classes(classes) -> dict:
    """
    Create a dictionary containing call signature information for a list of PhenEx classes.
    - keys are the PhenEx class names
    - values : a list of dictionaries with keys param, default, type, required
    Parameters:
    classes (list): A list of PhenEx classes to gather information from.
    Returns:
    dict: A dictionary containing call signature information for the specified PhenEx classes.
    """
    class_params_dict = {}
    for cls in classes:
        infos = create_call_signature_info_list_for_class(cls)
        class_params_dict[cls.__name__] = infos
    return class_params_dict


def create_call_signature_info_list_for_class(cls) -> list[dict]:
    """
    Gather information regarding the call signature of a *single* PhenEx class. For each parameter in a PhenEx class init's call signature, a dictionary is created with the keys:

    | param | Name of parameter in call signature |
    | default | The default value assigned to this parameter, if any |
    | type | The data type of the parameter e.g. str or Codelist |
    | required | Boolean on if the value is optional or not |

    Parameters:
    cls : a PhenEx class

    Returns:
    A list of dictionaries with keys param, default, type, required
    """
    params = get_phenex_init_params(cls)
    type_hints = get_type_hints(cls.__init__, globals())
    infos = []
    for k, v in params.items():
        if k not in ["self", "kwargs"]:
            d = {}
            d["param"] = k
            d["default"] = (
                None
                if v.default is inspect.Parameter.empty or v.default is None
                else str(v.default)
            )
            type_names, required = get_type_name_and_if_required(
                type_hints.get(k, v.annotation)
            )
            d["type"] = type_names if len(type_names) > 1 else type_names[0]
            d["required"] = required
            infos.append(d)
    return infos


def get_type_name_and_if_required(annotation: type) -> tuple:
    """
    This function takes a type annotation and returns a tuple containing a list of type names and a boolean indicating whether the type is required.

    Parameters:
    annotation (type): The type annotation to process.

    Returns:
    tuple: A tuple containing a list of type names and a boolean indicating whether the type is required.
    """
    if isinstance(annotation, ForwardRef):
        # If the annotation is a ForwardRef, return the forward reference argument as a list and False indicating it's not required.
        return [annotation.__forward_arg__], False

    if hasattr(annotation, "__origin__"):
        # If the annotation has an __origin__ attribute, it means it's a generic type (e.g., Union, List, Dict).
        origin = annotation.__origin__

        if origin is Union:
            # If the generic type is Union, process each argument in the Union.
            args = annotation.__args__
            types = []
            required = True
            for arg in args:
                if arg is type(None):
                    # If one of the arguments is NoneType, set required to False.
                    required = False
                else:
                    # Recursively get the type name for each argument and extend the types list.
                    type_name, _ = get_type_name_and_if_required(arg)
                    types.extend(type_name)
            return types, required

        elif origin is list:
            # If the generic type is list, process the list's argument.
            if hasattr(annotation, "__args__"):
                # Return the type name of the list's argument prefixed with 'List:' and True indicating it's required.
                return [
                    f"List:{get_type_name_and_if_required(annotation.__args__[0])[0][0]}"
                ], True
            else:
                # If the list has no arguments, return 'List' and True.
                return ["List"], True

        elif origin is dict:
            # If the generic type is dict, process the dict's arguments.
            if hasattr(annotation, "__args__"):
                # Return the type names of the dict's key and value arguments and True indicating it's required.
                return [
                    f"Dict[{get_type_name_and_if_required(annotation.__args__[0])[0][0]}, {get_type_name_and_if_required(annotation.__args__[1])[0]}]"
                ], True
            else:
                # If the dict has no arguments, return 'Dict' and True.
                return ["Dict"], True

        else:
            # For other generic types, return the origin's name and True indicating it's required.
            return [origin.__name__], True

    else:
        # If the annotation is not a generic type, return its name and True indicating it's required.
        return [annotation.__name__], True


if __name__ == "__main__":
    create_call_signature_info_dict_for_all_phenex_classes(
    )
