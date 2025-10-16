from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from itertools import combinations
from functools import reduce
import operator

from phenex.codelists import Codelist
from phenex.phenotypes import (
    LogicPhenotype,
)

from phenex.util import create_logger

logger = create_logger(__name__)

class StackableRegimen:
    def __init__(
        self,
        phenotypes: List[Any],
        regimen_keys: Optional[List[str]] = None,
        name: str = "sr",
    ) -> List[LogicPhenotype]:
        """
        Operational definition for a stackable regimen.
        
        Generates all possible combinations of regimens from size 1 up to max_combination_size of 10.
        For each combination:
        - All regimens in the combination must be active
        - All regimens NOT in the combination must be inactive
    
        Example:
        with three phenotypes named ['c1', 'c2', 'c3'] stackable regiments will create all combinations :
    
        # stack 1 phenotypes i.e. "single" regimen
        c1 & ~(c2 | c3)
        c2 & ~(c1 | c3)
        c3 & ~(c1 | c2)
        
        # stack 2 phenotypes i.e. "dual" regimen
        (c1 & c2) & ~c3
        (c1 & c3) & ~c2
        (c2 & c3) & ~c1
        
        # stack 3 phenotypes i.e. "triple" regimen
        c1 & c2 & c3
    
        Parameters:
            phenotypes: List of phenotypes to create combinations from
            regimen_keys: List of keys corresponding to phenotypes. If None, sequential integers will be used.
            name: Prefix used in naming the generated phenotypes
            return_date: Specify whether to return the date of the first, last or all regimen events
            
        Returns:
            Flat list of LogicPhenotype objects containing all generated regimen combinations
        """

        self.input_phenotypes = phenotypes
        self.regimen_keys = regimen_keys
        self.name = name

        self._phenotypes = None
        self._phenotypes_by_stack = None

    @property
    def phenotypes(self):
        if self._phenotypes is None:
            self._phenotypes = self.generate_phenotypes()
        return self._phenotypes

    @property
    def phenotypes_by_stack(self):
        if self._phenotypes_by_stack is None:
            self._phenotypes = self.generate_phenotypes()
        return self._phenotypes_by_stack
        
    def generate_phenotypes(self):
        # Convert list of self.phenotypes to a dictionary with keys
        self.phenotypes_dict = {}
        
        # If self.regimen_keys not provided, generate sequential numbers as keys
        if self.regimen_keys is None:
            self.regimen_keys = [x.name for x in self.input_phenotypes]
        else:
            if len(self.regimen_keys) != len(self.input_phenotypes):
                raise ValueError("length of regimen keys must be euql to the number of input phenotypes!")
        
        # Create dictionary mapping keys to self.phenotypes
        for i, phenotype in enumerate(self.input_phenotypes):
            if i < len(self.regimen_keys):
                self.phenotypes_dict[self.regimen_keys[i]] = phenotype
    
        # Limit max_combination_size to 10
        max_combination_size = 10
        
        # Generate all regimen combinations (returns a dictionary by size)
        self._phenotypes_by_stack = self._generate_n_regimen_combinations(
            regimen_keys=self.regimen_keys,
            phenotypes_dict=self.phenotypes_dict,
            prefix=self.name,
        )
        # Flatten the dictionary into a single list
        result_list = []
        for size_phenotypes in self._phenotypes_by_stack.values():
            result_list.extend(size_phenotypes)
        return result_list


    def _generate_n_regimen_combinations(
        self,
        regimen_keys: List[str],
        phenotypes_dict: Dict[str, Any],
        prefix: str,
    ) -> Dict[str, List[LogicPhenotype]]:
        """
        Internal helper function to generate all possible combinations of regimens.
        
        For each n-sized combination:
        - All regimens in the combination must be active (using & operator)
        - All regimens NOT in the combination must be inactive (using ~ and | operators)
        
        Parameters:
            regimen_keys: List of regimen keys to combine
            phenotypes_dict: Dictionary mapping regimen keys to phenotypes
            prefix: Name prefix for the generated phenotypes
            
        Returns:
            Dictionary mapping combination size prefixes to lists of LogicPhenotype objects.
            This dictionary is flattened before being returned to the user by StackableRegimen.
        """
        # Use simple size prefixes in the format "s1", "s2", etc.
        n_regimens = len(regimen_keys)
        results = {}
        
        # Generate combinations for each size from 1 to n_regimens
        for size in range(1, n_regimens + 1):
            phenotype_list = []
            stack_key = f"stack{size}"  # Simple prefix format: s1, s2, etc.
            
            # Use the python itertools combination function. Generate all combinations of the given size
            for combo in combinations(regimen_keys, size):
                # combo is a tuple; convert to list
                regimen_combo = list(combo)
                
                # Get regimens NOT in the combination
                other_regimen_keys = [key for key in regimen_keys if key not in regimen_combo]
                
                # Create name based on combination size and regimen names
                if size == n_regimens:  # Special case for when all regimens are included
                    name = f"{prefix}_ALL"
                else:
                    # Process regimen names (remove 'hf_' prefix and get first part)
                    processed_names = [r.replace("hf_", "").split('_')[0] for r in regimen_combo]
                    name = f"{prefix}_{stack_key}_" + "_".join(processed_names)
                
                # Build the logic expression:
                # 1. AND together all regimens in the combination
                included_logic = reduce(operator.and_, [phenotypes_dict[r] for r in regimen_combo])
                
                # 2. OR together all regimens NOT in the combination (if any)
                if other_regimen_keys:
                    excluded_logic = reduce(operator.or_, [phenotypes_dict[r] for r in other_regimen_keys])
                    # Final logic: (A & B & C & ...) & ~(X | Y | Z | ...)
                    logic = included_logic & ~excluded_logic
                else:
                    # If all regimens are included in the combination, there's nothing to exclude
                    logic = included_logic
                
                # Create the phenotype and add to the list
                phenotype = LogicPhenotype(name=name, expression=logic)
                phenotype_list.append(phenotype)
            
            # Add the list to results dictionary
            results[stack_key] = phenotype_list
        
        return results
     