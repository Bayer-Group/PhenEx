from typing import Dict, List


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
        updated_phenotypes = [p for p in updated_phenotypes if p.get("class_name") is not None]

        cohort["phenotypes"] = updated_phenotypes
        return cohort
