import copy
from typing import Dict, List, Any

def resolve_constants_in_cohort(cohort_data: Dict[str, Any], constants: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Resolve constant references in a cohort's phenotypes.
    
    Args:
        cohort_data: The full cohort_data dictionary (phenotypes-only format)
        constants: List of constant dictionaries fetched from the database
        
    Returns:
        A new cohort_data dictionary with constants resolved
    """
    if not constants or "phenotypes" not in cohort_data:
        return cohort_data
        
    # Build dictionary for faster lookup
    constants_dict = {c["name"]: c["value"] for c in constants}
    
    # Deep copy to avoid modifying original
    resolved_data = copy.deepcopy(cohort_data)
    
    for phenotype in resolved_data.get("phenotypes", []):
        # Resolve relative time range constants
        if "relative_time_range" in phenotype:
            rtr_list = phenotype["relative_time_range"]
            # Handle both list and dict formats for relative_time_range
            if isinstance(rtr_list, list):
                for i, rtr in enumerate(rtr_list):
                    if isinstance(rtr, dict) and rtr.get("useConstant") and rtr.get("constant"):
                        constant_name = rtr["constant"]
                        if constant_name in constants_dict:
                            rtr_list[i] = constants_dict[constant_name]
            elif isinstance(rtr_list, dict):
                if rtr_list.get("useConstant") and rtr_list.get("constant"):
                    constant_name = rtr_list["constant"]
                    if constant_name in constants_dict:
                        phenotype["relative_time_range"] = [constants_dict[constant_name]]
                        
        # Resolve categorical filter constants
        if "value_filter" in phenotype:
            vf = phenotype["value_filter"]
            if isinstance(vf, dict) and vf.get("class_name") == "CategoricalFilter":
                if vf.get("useConstant") and vf.get("constant"):
                    constant_name = vf["constant"]
                    if constant_name in constants_dict:
                        phenotype["value_filter"] = constants_dict[constant_name]
                        
        # Support direct categorical_filter field if used
        if "categorical_filter" in phenotype:
            cf = phenotype["categorical_filter"]
            if isinstance(cf, dict):
                if cf.get("useConstant") and cf.get("constant"):
                    constant_name = cf["constant"]
                    if constant_name in constants_dict:
                        phenotype["categorical_filter"] = constants_dict[constant_name]

    return resolved_data
