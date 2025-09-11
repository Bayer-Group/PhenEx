from typing import Dict
from phenex.mappers import DomainsDictionary
from phenex.tables import PhenexTable
import pandas as pd
import numpy as np
import ibis
from datetime import datetime, timedelta


def generate_mock_mapped_tables(
    domains: DomainsDictionary, n_patients: int = 10000, seed: int = 42
) -> Dict[str, PhenexTable]:
    """
    Generate fake data for N patients based on the given domains.

    Args:
        domains (DomainsDictionary): The domains dictionary containing the table mappers.
        n_patients (int): The number of patients to generate data for.
        seed (int): Random seed for reproducible results.

    Returns:
        Dict[str, PhenexTable]: A dictionary where keys are domain names and values are PhenexTable instances with fake data.
    """
    np.random.seed(seed)

    # Generate base patient demographics first
    base_patient_ids = np.arange(1, n_patients + 1)
    birth_dates = pd.to_datetime(
        np.random.choice(
            pd.date_range(start="1920-01-01", end="2010-12-31").date, size=n_patients
        )
    )

    fake_data = {}
    for domain, mapper in domains.domains_dict.items():
        # Get original column names from DEFAULT_MAPPING values
        # DEFAULT_MAPPING maps from PhenEx field names to original column names
        original_columns = list(mapper.DEFAULT_MAPPING.values())

        # Determine number of records for this table (some tables have multiple records per patient)
        if "PERSON" in domain:
            n_records = n_patients
            patient_ids = base_patient_ids
        elif any(
            x in domain
            for x in ["CONDITION", "DRUG", "PROCEDURE", "OBSERVATION", "MEASUREMENT"]
        ):
            # Event tables: each patient can have multiple records
            n_records = np.random.poisson(
                lam=3, size=n_patients
            ).sum()  # avg 3 events per patient
            patient_ids = np.random.choice(
                base_patient_ids, size=n_records, replace=True
            )
        elif "VISIT" in domain:
            # Visit tables: patients have fewer visits
            n_records = np.random.poisson(
                lam=2, size=n_patients
            ).sum()  # avg 2 visits per patient
            patient_ids = np.random.choice(
                base_patient_ids, size=n_records, replace=True
            )
        else:
            n_records = n_patients
            patient_ids = base_patient_ids

        data = {}
        for col in original_columns:
            if "PERSON_ID" in col:
                data[col] = patient_ids
            elif "BIRTH" in col and "DATE" in col:
                # Birth dates for person table
                if n_records == n_patients:
                    data[col] = birth_dates
                else:
                    # For event tables, get birth dates for the corresponding patients
                    data[col] = birth_dates[
                        patient_ids - 1
                    ]  # patient_ids are 1-indexed
            elif "YEAR_OF_BIRTH" in col:
                birth_datetime_data = data.get("BIRTH_DATETIME", birth_dates)
                birth_years = pd.to_datetime(birth_datetime_data).year
                data[col] = birth_years
            elif "DATE" in col or "DATETIME" in col:
                # Generate realistic dates based on context
                if "DEATH" in col:
                    # Death dates should be after birth dates and not too recent
                    start_dates = pd.to_datetime(
                        data.get("BIRTH_DATETIME", birth_dates)
                    ) + pd.Timedelta(
                        days=365 * 20
                    )  # at least 20 years old
                    end_date = datetime.now() - timedelta(
                        days=30
                    )  # deaths are reported with delay
                    date_range = (end_date - start_dates[0]).days
                    random_days = np.random.randint(
                        0, max(1, date_range), size=n_records
                    )
                    data[col] = (
                        start_dates[0] + pd.to_timedelta(random_days, unit="D")
                    ).date
                elif any(
                    x in col for x in ["START", "EXPOSURE_START", "CONDITION_START"]
                ):
                    # Event start dates should be realistic (after birth, not too far in future)
                    start_date = datetime(2010, 1, 1)
                    end_date = datetime(2023, 12, 31)
                    date_range = (end_date - start_date).days
                    random_days = np.random.randint(0, date_range, size=n_records)
                    data[col] = (
                        start_date + pd.to_timedelta(random_days, unit="D")
                    ).date
                elif any(x in col for x in ["END", "EXPOSURE_END", "CONDITION_END"]):
                    # End dates should be after start dates
                    if any("START" in existing_col for existing_col in data.keys()):
                        start_col = next((c for c in data.keys() if "START" in c), None)
                        if start_col:
                            start_dates = pd.to_datetime(data[start_col])
                            duration_days = np.random.exponential(
                                scale=30, size=n_records
                            )  # avg 30 days
                            end_datetimes = start_dates + pd.to_timedelta(
                                duration_days, unit="D"
                            )
                            data[col] = end_datetimes.date
                        else:
                            data[col] = pd.date_range(
                                start="2010-01-01", end="2023-12-31", periods=n_records
                            ).date
                    else:
                        data[col] = pd.date_range(
                            start="2010-01-01", end="2023-12-31", periods=n_records
                        ).date
                else:
                    # General date fields
                    data[col] = pd.date_range(
                        start="2010-01-01", end="2023-12-31", periods=n_records
                    ).date
            elif "ID" in col and "PERSON_ID" not in col:
                # Other ID fields (visit_id, occurrence_id, etc.)
                data[col] = np.arange(1, n_records + 1)
            elif "VALUE" in col:
                # Generate realistic measurement values for observations/measurements
                if "OBSERVATION" in domain or "MEASUREMENT" in domain:
                    # Values vary widely for different types of observations
                    # Some are vital signs, some are lab values, some are categorical
                    value_types = np.random.choice(
                        ["vital_signs", "lab_values", "categorical"],
                        size=n_records,
                        p=[0.3, 0.5, 0.2],
                    )
                    values = np.zeros(n_records)

                    # Vital signs (BP, temp, weight, height, etc.) - typically 60-200 range
                    vital_mask = value_types == "vital_signs"
                    values[vital_mask] = np.random.normal(
                        loc=120, scale=30, size=vital_mask.sum()
                    )

                    # Lab values - wide range, often log-normal
                    lab_mask = value_types == "lab_values"
                    values[lab_mask] = np.random.lognormal(
                        mean=3, sigma=1.5, size=lab_mask.sum()
                    )

                    # Categorical/ordinal values (pain scales, etc.) - 0-10 range
                    cat_mask = value_types == "categorical"
                    values[cat_mask] = np.random.randint(0, 11, size=cat_mask.sum())

                    data[col] = np.abs(values)  # Ensure positive values
                else:
                    # For other domains, use log-normal distribution for positive values
                    data[col] = np.random.lognormal(mean=2, sigma=1, size=n_records)
            elif "CODE_TYPE" in col or "TYPE" in col:
                if "CONDITION" in domain:
                    data[col] = np.random.choice(
                        ["ICD-10-CM", "SNOMED-CT", "ICD-9-CM"],
                        size=n_records,
                        p=[0.6, 0.3, 0.1],
                    )
                elif "DRUG" in domain:
                    data[col] = np.random.choice(
                        ["NDC", "RxNorm", "ATC"], size=n_records, p=[0.5, 0.4, 0.1]
                    )
                elif "PROCEDURE" in domain:
                    data[col] = np.random.choice(
                        ["CPT-4", "HCPCS", "ICD-10-PCS"],
                        size=n_records,
                        p=[0.5, 0.3, 0.2],
                    )
                else:
                    data[col] = np.random.choice(
                        ["TYPE_A", "TYPE_B", "TYPE_C"], size=n_records
                    )
            elif "CODE" in col or "CONCEPT_ID" in col:
                # Generate realistic medical codes
                if "CONDITION" in domain:
                    # Common ICD-10 codes for conditions
                    codes = [
                        "E11.9",
                        "I10",
                        "Z51.11",
                        "M79.3",
                        "K59.00",
                        "R06.02",
                        "F17.210",
                    ]
                    data[col] = np.random.choice(codes, size=n_records)
                elif "DRUG" in domain:
                    # Common drug codes
                    codes = [
                        "50090-3568",
                        "68645-498",
                        "00074-3368",
                        "55111-118",
                        "16729-298",
                    ]
                    data[col] = np.random.choice(codes, size=n_records)
                elif "PROCEDURE" in domain:
                    # Common CPT codes
                    codes = ["99213", "99214", "36415", "85025", "80053", "93000"]
                    data[col] = np.random.choice(codes, size=n_records)
                elif "OBSERVATION" in domain:
                    # Common observation codes - vital signs, measurements, assessments
                    codes = [
                        "8480-6",
                        "8462-4",
                        "29463-7",
                        "3141-9",
                        "8310-5",  # BP systolic, diastolic, weight, height, temp
                        "33743-4",
                        "77606-2",
                        "72133-2",
                        "38208-5",
                        "9279-1",
                    ]  # pain scale, BMI, smoking status, etc.
                    data[col] = np.random.choice(codes, size=n_records)
                elif "MEASUREMENT" in domain:
                    # Common lab measurement codes (LOINC codes)
                    codes = [
                        "2093-3",
                        "2085-9",
                        "33747-0",
                        "2160-0",
                        "6299-2",  # cholesterol, HDL, hemoglobin, creatinine, urea
                        "17861-6",
                        "1975-2",
                        "2947-0",
                        "1558-6",
                        "4548-4",
                    ]  # glucose, bilirubin, sodium, fasting glucose, A1C
                    data[col] = np.random.choice(codes, size=n_records)
                else:
                    data[col] = np.random.choice(
                        [f"C{i:06d}" for i in range(1000)], size=n_records
                    )
            elif "SEX" in col or "GENDER" in col:
                data[col] = np.random.choice(
                    ["M", "F", "MALE", "FEMALE"], size=n_records
                )
            elif "ETHNICITY" in col or "RACE" in col:
                ethnicities = ["Hispanic", "Not Hispanic", "Unknown", "Other"]
                data[col] = np.random.choice(
                    ethnicities, size=n_records, p=[0.2, 0.7, 0.05, 0.05]
                )
            elif "SOURCE" in col:
                # Source values are often codes or strings from the original system
                if "CODE" in col or "VALUE" in col:
                    data[col] = np.random.choice(
                        [f"SRC_{i}" for i in range(100)], size=n_records
                    )
                else:
                    data[col] = np.random.choice(
                        ["EHR", "CLAIMS", "REGISTRY", "SURVEY"], size=n_records
                    )
            else:
                # Default: random integers for any unhandled columns
                data[col] = np.random.randint(1, 1000, size=n_records)

        # Create ibis table from pandas DataFrame
        ibis_table = ibis.memtable(pd.DataFrame(data))

        # Create PhenexTable instance using the mapper class with drop_unmapped=True
        fake_data[domain] = mapper(ibis_table)
    return fake_data
