from typing import Dict
from phenex.mappers import DomainsDictionary
import pandas as pd
import numpy as np
from dataclasses import asdict


def generate_mock_mapped_tables(
    n_patients: int, domains: DomainsDictionary
) -> Dict[str, pd.DataFrame]:
    """
    Generate fake data for N patients based on the given domains.

    Args:
        n_patients (int): The number of patients to generate data for.
        domains (DomainsDictionary): The domains dictionary containing the table mappers.

    Returns:
        Dict[str, pd.DataFrame]: A dictionary where keys are domain names and values are DataFrames with fake data.
    """
    fake_data = {}
    for domain, mapper in domains.domains_dict.items():
        columns = [field for field in asdict(mapper).keys() if field != "NAME_TABLE"]
        data = {}
        for col in columns:
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
        fake_data[domain] = pd.DataFrame(data)
    return fake_data
