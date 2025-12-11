"""
Validation utilities for cohort data format.
"""
from typing import Dict


def validate_cohort_data_format(cohort_data: Dict) -> None:
    """
    Validates that cohort_data follows the phenotypes-only format.
    
    The cohort_data must contain a 'phenotypes' array where each phenotype has a 'type' field.
    It must NOT contain the legacy structured keys: entry_criterion, inclusions, exclusions, 
    characteristics, or outcomes.
    
    Args:
        cohort_data: The cohort data dictionary to validate
        
    Raises:
        ValueError: If the cohort_data format is invalid. Callers can catch and re-raise
                   as HTTPException(422) in API routes if needed.
    """
    has_phenotypes_array = "phenotypes" in cohort_data and isinstance(cohort_data.get("phenotypes"), list)
    
    # Check for legacy structured keys
    legacy_keys = ["entry_criterion", "inclusions", "exclusions", "characteristics", "outcomes"]
    found_legacy_keys = [key for key in legacy_keys if key in cohort_data]
    
    if not has_phenotypes_array:
        raise ValueError(
            "Cohort data must contain a 'phenotypes' array. The legacy structured format "
            "(entry_criterion, inclusions, exclusions, characteristics, outcomes) is no longer supported."
        )
    
    if found_legacy_keys:
        raise ValueError(
            f"Cohort data contains legacy structured keys: {found_legacy_keys}. "
            f"Only the 'phenotypes' array format is supported. Each phenotype should have a 'type' field "
            f"(entry, inclusion, exclusion, baseline, outcome) instead of being split into separate keys."
        )
