from typing import Dict, List, Any


def transform_value_filter_for_ui(value_filter: Dict) -> Dict:
    """
    Transform PhenEx value_filter format to UI format.
    PhenEx uses class names (GreaterThanOrEqual) while UI expects operator strings (>=).
    
    Args:
        value_filter: ValueFilter dict from PhenEx
        
    Returns:
        Transformed value_filter dict for UI
    """
    if not value_filter or not isinstance(value_filter, dict):
        return value_filter
    
    # Mapping from PhenEx class names to UI operators
    class_to_operator = {
        'GreaterThan': '>',
        'GreaterThanOrEqual': '>=',
        'GreaterThanOrEqualTo': '>=',  # Alternative name
        'LessThan': '<',
        'LessThanOrEqual': '<=',
        'LessThanOrEqualTo': '<=',  # Alternative name
    }
    
    result = {
        'class_name': 'ValueFilter',
        'column_name': value_filter.get('column_name', '')
    }
    
    # Transform min_value
    if 'min_value' in value_filter and value_filter['min_value']:
        min_val = value_filter['min_value']
        if isinstance(min_val, dict):
            operator_class = min_val.get('class_name', '')
            result['min_value'] = {
                'class_name': 'Value',
                'operator': class_to_operator.get(operator_class, '>='),
                'value': min_val.get('value')
            }
        else:
            result['min_value'] = None
    else:
        result['min_value'] = None
    
    # Transform max_value  
    if 'max_value' in value_filter and value_filter['max_value']:
        max_val = value_filter['max_value']
        if isinstance(max_val, dict):
            operator_class = max_val.get('class_name', '')
            result['max_value'] = {
                'class_name': 'Value',
                'operator': class_to_operator.get(operator_class, '<='),
                'value': max_val.get('value')
            }
        else:
            result['max_value'] = None
    else:
        result['max_value'] = None
    
    return result


def transform_phenotype_for_ui(phenotype: Dict) -> Dict:
    """
    Transform a phenotype from PhenEx format to UI format.
    Recursively transforms value_filter fields.
    
    Args:
        phenotype: Phenotype dict from PhenEx
        
    Returns:
        Transformed phenotype dict for UI
    """
    if not phenotype or not isinstance(phenotype, dict):
        return phenotype
    
    result = phenotype.copy()
    
    # Transform value_filter if present
    if 'value_filter' in result and result['value_filter']:
        result['value_filter'] = transform_value_filter_for_ui(result['value_filter'])
    
    return result


def transform_cohort_for_ui(cohort: Dict) -> Dict:
    """
    Transform entire cohort from PhenEx format to UI format.
    
    Args:
        cohort: Cohort dict from PhenEx
        
    Returns:
        Transformed cohort dict for UI
    """
    if not cohort or not isinstance(cohort, dict):
        return cohort
    
    result = cohort.copy()
    
    # Transform phenotypes list
    if 'phenotypes' in result and result['phenotypes']:
        result['phenotypes'] = [transform_phenotype_for_ui(p) for p in result['phenotypes']]
    
    # Transform categorized phenotype lists
    for category in ['entry_criterion', 'inclusions', 'exclusions', 'characteristics', 'outcomes']:
        if category in result:
            if category == 'entry_criterion' and result[category]:
                result[category] = transform_phenotype_for_ui(result[category])
            elif isinstance(result[category], list):
                result[category] = [transform_phenotype_for_ui(p) for p in result[category]]
    
    return result


class CohortUtils:
    @staticmethod
    def convert_phenotypes_to_structure(cohort: Dict) -> Dict:
        """
        Converts a cohort from the list of phenotypes representation to the structured
        representation with entry_criterion, inclusions, exclusions, characteristics, and outcomes.

        Args:
            cohort (Dict): The cohort in the list of phenotypes representation.

        Returns:
            Dict: The cohort in the structured representation.
        """
        structured_cohort = {
            "id": cohort.get("id"),
            "name": cohort.get("name"),
            "class_name": cohort.get("class_name"),
            "phenotypes": cohort.get("phenotypes"),
            "entry_criterion": None,
            "inclusions": [],
            "exclusions": [],
            "characteristics": [],
            "outcomes": [],
            "database_config": cohort.get("database_config"),
        }

        for phenotype in cohort.get("phenotypes", []):
            phenotype_type = phenotype.get("type")
            if phenotype_type == "entry":
                structured_cohort["entry_criterion"] = phenotype
            elif phenotype_type == "inclusion":
                structured_cohort["inclusions"].append(phenotype)
            elif phenotype_type == "exclusion":
                structured_cohort["exclusions"].append(phenotype)
            elif phenotype_type == "characteristic":
                structured_cohort["characteristics"].append(phenotype)
            elif phenotype_type == "outcome":
                structured_cohort["outcomes"].append(phenotype)

        return structured_cohort

    @staticmethod
    def convert_structure_to_phenotypes(cohort: Dict) -> Dict:
        """
        Converts a cohort from the structured representation with entry_criterion, inclusions,
        exclusions, characteristics, and outcomes back to the list of phenotypes representation.

        Args:
            cohort (Dict): The cohort in the structured representation.

        Returns:
            Dict: The cohort in the list of phenotypes representation.
        """
        phenotypes = []

        if cohort.get("entry_criterion"):
            phenotypes.append(cohort["entry_criterion"])

        phenotypes.extend(cohort.get("inclusions", []))
        phenotypes.extend(cohort.get("exclusions", []))
        phenotypes.extend(cohort.get("characteristics", []))
        phenotypes.extend(cohort.get("outcomes", []))

        return {
            "id": cohort.get("id"),
            "name": cohort.get("name"),
            "class_name": cohort.get("class_name"),
            "phenotypes": phenotypes,
            "database_config": cohort.get("database_config"),
        }

    @staticmethod
    def update_cohort(cohort: Dict, udpate_cohort: List[Dict]) -> Dict:
        """
        Updates a cohort by replacing a phenotype with the given ID with a new phenotype.

        Args:
            cohort (Dict): The cohort in the list of phenotypes representation.
            udpate_cohort (List[Dict]): The udpate_cohort with just new phenotypes.

        Returns:
            Dict: The updated cohort.
        """
        new_phenotypes = udpate_cohort.get("phenotypes", [])
        new_ids = [p.get("id") for p in new_phenotypes]
        old_phenotypes = cohort.get("phenotypes", [])

        updated_phenotypes = new_phenotypes + [
            p for p in old_phenotypes if p.get("id") not in new_ids
        ]
        updated_phenotypes = [
            p for p in updated_phenotypes if p.get("class_name") is not None
        ]

        cohort["phenotypes"] = updated_phenotypes
        return cohort
