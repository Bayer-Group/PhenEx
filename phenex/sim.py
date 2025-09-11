from typing import Dict
from phenex.mappers import DomainsDictionary
from phenex.tables import PhenexTable
import pandas as pd
import numpy as np
import ibis


def generate_mock_mapped_tables(
    domains: DomainsDictionary, n_patients: int = 10000
) -> Dict[str, PhenexTable]:
    """
    Generate fake data for N patients based on the given domains.

    Args:
        domains (DomainsDictionary): The domains dictionary containing the table mappers.
        n_patients (int): The number of patients to generate data for.

    Returns:
        Dict[str, PhenexTable]: A dictionary where keys are domain names and values are PhenexTable instances with fake data.
    """
    fake_data = {}
    for domain, mapper in domains.domains_dict.items():
        # Get original column names from DEFAULT_MAPPING values
        # DEFAULT_MAPPING maps from PhenEx field names to original column names
        original_columns = list(mapper.DEFAULT_MAPPING.values())
        data = {}
        for col in original_columns:
            if "DATE" in col:
                start_date = pd.to_datetime("2000-01-01")
                end_date = pd.to_datetime("2020-12-31")
                data[col] = pd.to_datetime(
                    np.random.randint(start_date.value, end_date.value, n_patients)
                ).date
            elif "ID" in col:
                data[col] = np.arange(1, n_patients + 1)
            elif "VALUE" in col:
                data[col] = np.random.uniform(0, 100, n_patients)
            elif "CODE_TYPE" in col:
                if "CONDITION" in domain:
                    data[col] = np.random.choice(["ICD-10", "SNOMED"], n_patients)
                elif "DRUG" in domain:
                    data[col] = np.random.choice(["NDC", "RxNorm"], n_patients)
                elif "PROCEDURE" in domain:
                    data[col] = np.random.choice(["CPT", "HCPCS"], n_patients)
                else:
                    data[col] = np.random.choice(["TYPE1", "TYPE2"], n_patients)
            elif "CODE" in col:
                data[col] = np.random.choice(
                    ["A", "B", "C", "D", "E", "F", "G"], n_patients
                )
            else:
                data[col] = np.random.choice(range(1000), n_patients)

        # Create ibis table from pandas DataFrame
        ibis_table = ibis.memtable(pd.DataFrame(data))

        # Create PhenexTable instance using the mapper class with drop_unmapped=True
        fake_data[domain] = mapper(ibis_table)
    return fake_data
