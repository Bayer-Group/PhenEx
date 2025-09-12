from typing import Dict
from phenex.mappers import DomainsDictionary
from phenex.tables import PhenexTable
import pandas as pd
import numpy as np
import ibis
from datetime import datetime, timedelta


class DomainsMocker:
    """
    A class to mock healthcare data domains for testing and simulation purposes.

    This is a Mock - it represents the basic structure of the data without caring too much about accurate statistics. The statistics should be reasonable (e.g. Poisson, Gaussian, log-normal when appropriate), and the content should be domain-appropriate (e.g. using relevant codes/code types) but we are NOT trying to accurately model real data.
    """

    def __init__(
        self,
        domains_dict: DomainsDictionary,
        n_patients: int = 10000,
        random_seed: int = 42,
    ):
        """
        Initialize the DomainsMocker.

        Args:
            domains_dict (DomainsDictionary): The domains dictionary containing table mappers
            n_patients (int): Number of patients to simulate
            random_seed (int): Random seed for reproducible results
        """
        self.domains_dict = domains_dict
        self.n_patients = n_patients
        self.random_seed = random_seed
        np.random.seed(random_seed)

        # Generate base patient IDs that look more realistic (7-8 digit numbers)
        self.base_patient_ids = self._generate_realistic_ids(n_patients, base=1000000)

        # Pre-generate visit detail IDs for consistency across tables
        self._visit_detail_ids_pool = None

        # Cache for source tables to ensure consistent data on multiple calls
        self._cached_source_tables = None

    def _generate_realistic_ids(self, count: int, base: int = 1000000) -> np.ndarray:
        """
        Generate realistic-looking IDs that don't follow simple sequential patterns.

        Args:
            count (int): Number of IDs to generate
            base (int): Base number to start from (default: 1M for 7-8 digit IDs)

        Returns:
            np.ndarray: Array of realistic-looking IDs
        """
        # Generate IDs that look realistic but are still deterministic given the seed
        ids = (
            base + np.arange(count) * np.random.randint(3, 47, size=1)[0]
        )  # Random step between 3-47
        ids += np.random.randint(0, 999, size=count)  # Add some random noise
        return ids

    def _mock_person_table(self) -> pd.DataFrame:
        """
        Mock the PERSON table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked person table data
        """
        # Gender: roughly 50/50 split with OMOP concept IDs
        gender_concepts = np.random.choice(
            [8507, 8532], size=self.n_patients, p=[0.51, 0.49]
        )  # Female, Male
        gender_source_values = np.where(gender_concepts == 8507, "F", "M")

        # Birth years: reasonable distribution from 1930-2010
        birth_years = np.random.choice(
            np.arange(1930, 2011),
            size=self.n_patients,
            p=self._generate_birth_year_probs(),
        )

        # Birth months and days
        birth_months = np.random.randint(1, 13, size=self.n_patients)
        birth_days = np.random.randint(
            1, 29, size=self.n_patients
        )  # Keep it simple, avoid month/day complications

        # Birth datetime
        birth_datetimes = pd.to_datetime(
            {"year": birth_years, "month": birth_months, "day": birth_days}
        )

        # Race concepts (US demographics roughly)
        race_concepts = np.random.choice(
            [
                8527,
                8516,
                8515,
                8557,
                0,
            ],  # White, Black, Asian, Native American, Unknown
            size=self.n_patients,
            p=[0.72, 0.13, 0.06, 0.01, 0.08],
        )
        race_source_values = np.select(
            [
                race_concepts == 8527,
                race_concepts == 8516,
                race_concepts == 8515,
                race_concepts == 8557,
                race_concepts == 0,
            ],
            [
                "White",
                "Black or African American",
                "Asian",
                "American Indian or Alaska Native",
                "Unknown",
            ],
            default="Other",
        )

        # Ethnicity concepts
        ethnicity_concepts = np.random.choice(
            [38003563, 38003564, 0],  # Hispanic, Not Hispanic, Unknown
            size=self.n_patients,
            p=[0.18, 0.79, 0.03],
        )
        ethnicity_source_values = np.select(
            [
                ethnicity_concepts == 38003563,
                ethnicity_concepts == 38003564,
                ethnicity_concepts == 0,
            ],
            ["Hispanic or Latino", "Not Hispanic or Latino", "Unknown"],
            default="Other",
        )

        # Optional fields - some patients will have these, others won't
        location_ids = np.where(
            np.random.random(self.n_patients) < 0.7,  # 70% have location
            self._generate_realistic_ids(self.n_patients, base=200000)[
                : self.n_patients
            ],  # 6-7 digit location IDs
            np.nan,
        )

        provider_ids = np.where(
            np.random.random(self.n_patients) < 0.8,  # 80% have provider
            self._generate_realistic_ids(self.n_patients, base=800000)[
                : self.n_patients
            ],  # 6-7 digit provider IDs
            np.nan,
        )

        care_site_ids = np.where(
            np.random.random(self.n_patients) < 0.6,  # 60% have care site
            self._generate_realistic_ids(self.n_patients, base=300000)[
                : self.n_patients
            ],  # 6-7 digit care site IDs
            np.nan,
        )

        # Person source values (often medical record numbers)
        person_source_values = [f"MRN{pid:08d}" for pid in self.base_patient_ids]

        return pd.DataFrame(
            {
                "PERSON_ID": self.base_patient_ids,
                "GENDER_CONCEPT_ID": gender_concepts,
                "YEAR_OF_BIRTH": birth_years,
                "MONTH_OF_BIRTH": birth_months,
                "DAY_OF_BIRTH": birth_days,
                "BIRTH_DATETIME": birth_datetimes,
                "RACE_CONCEPT_ID": race_concepts,
                "ETHNICITY_CONCEPT_ID": ethnicity_concepts,
                "LOCATION_ID": location_ids,
                "PROVIDER_ID": provider_ids,
                "CARE_SITE_ID": care_site_ids,
                "PERSON_SOURCE_VALUE": person_source_values,
                "GENDER_SOURCE_VALUE": gender_source_values,
                "GENDER_SOURCE_CONCEPT_ID": gender_concepts,  # Same as gender_concept_id for simplicity
                "RACE_SOURCE_VALUE": race_source_values,
                "RACE_SOURCE_CONCEPT_ID": race_concepts,  # Same as race_concept_id for simplicity
                "ETHNICITY_SOURCE_VALUE": ethnicity_source_values,
                "ETHNICITY_SOURCE_CONCEPT_ID": ethnicity_concepts,  # Same as ethnicity_concept_id for simplicity
            }
        )

    def _generate_birth_year_probs(self) -> np.ndarray:
        """Generate realistic birth year probabilities (more recent years more later)."""
        years = np.arange(1930, 2011)
        # Exponential-like distribution favoring more recent years
        probs = np.exp((years - 1930) * 0.02)
        return probs / probs.sum()

    def _mock_condition_occurrence_table(self) -> pd.DataFrame:
        """
        Mock the CONDITION_OCCURRENCE table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked condition occurrence table data
        """
        # Generate conditions for patients - use Poisson distribution for number of conditions per patient
        conditions_per_patient = np.random.poisson(
            lam=3.5, size=self.n_patients
        )  # Average 3-4 conditions per patient
        conditions_per_patient = np.clip(
            conditions_per_patient, 0, 20
        )  # Cap at 20 conditions

        total_conditions = conditions_per_patient.sum()

        # Generate condition occurrence IDs that look realistic
        condition_occurrence_ids = self._generate_realistic_ids(
            total_conditions, base=50000000
        )  # 8-digit IDs

        # Generate person IDs based on conditions per patient
        person_ids = np.repeat(self.base_patient_ids, conditions_per_patient)

        # Common condition concept IDs (diabetes, hypertension, depression, etc.)
        common_condition_concepts = [
            201820,  # Diabetes mellitus
            316866,  # Hypertensive disorder
            440383,  # Depressive disorder
            432867,  # Asthma
            4329847,  # Myocardial infarction
            321596,  # Cough
            378253,  # Headache
            312327,  # Back pain
            4170143,  # Chest pain
            200219,  # Pneumonia
        ]
        condition_concept_ids = np.random.choice(
            common_condition_concepts, size=total_conditions
        )

        # Generate dates - condition start dates over last 10 years
        start_date = datetime(2014, 1, 1)
        end_date = datetime(2024, 12, 31)
        date_range = (end_date - start_date).days

        condition_start_dates = [
            start_date + timedelta(days=int(np.random.uniform(0, date_range)))
            for _ in range(total_conditions)
        ]
        condition_start_datetimes = [
            dt
            + timedelta(
                hours=np.random.randint(0, 24), minutes=np.random.randint(0, 60)
            )
            for dt in condition_start_dates
        ]

        # End dates - 70% have end dates, rest are ongoing
        has_end_date = np.random.random(total_conditions) < 0.7
        condition_end_dates = []
        condition_end_datetimes = []

        for i, has_end in enumerate(has_end_date):
            if has_end:
                # End date 1-365 days after start
                days_duration = np.random.exponential(
                    30
                )  # Average 30 days, exponential distribution
                days_duration = min(days_duration, 365)  # Cap at 1 year
                end_dt = condition_start_dates[i] + timedelta(days=int(days_duration))
                condition_end_dates.append(end_dt.date())
                condition_end_datetimes.append(
                    end_dt
                    + timedelta(
                        hours=np.random.randint(0, 24), minutes=np.random.randint(0, 60)
                    )
                )
            else:
                condition_end_dates.append(None)
                condition_end_datetimes.append(None)

        # Condition type concept IDs (how condition was recorded)
        condition_type_concepts = np.random.choice(
            [32020, 32817, 32810, 32840],  # EHR, Claim, Physical exam, Survey
            size=total_conditions,
            p=[0.6, 0.25, 0.1, 0.05],
        )

        # Optional fields with realistic presence rates
        stop_reasons = np.where(
            np.random.random(total_conditions) < 0.1,  # 10% have stop reason
            np.random.choice(
                ["Resolved", "Patient request", "Side effects", "No longer indicated"],
                size=total_conditions,
            ),
            None,
        )

        provider_ids = np.where(
            np.random.random(total_conditions) < 0.85,  # 85% have provider
            self._generate_realistic_ids(total_conditions, base=800000)[
                :total_conditions
            ],
            None,
        )

        visit_occurrence_ids = np.where(
            np.random.random(total_conditions) < 0.90,  # 90% associated with visit
            self._generate_realistic_ids(total_conditions, base=60000000)[
                :total_conditions
            ],  # 8-digit visit IDs
            None,
        )

        visit_detail_ids = np.where(
            np.random.random(total_conditions) < 0.30,  # 30% have visit detail
            np.random.choice(
                self._get_visit_detail_ids_pool(), size=total_conditions
            ),  # Use consistent IDs
            None,
        )

        # Source values - human readable condition names
        condition_source_values = np.select(
            [
                condition_concept_ids == 201820,
                condition_concept_ids == 316866,
                condition_concept_ids == 440383,
                condition_concept_ids == 432867,
                condition_concept_ids == 4329847,
                condition_concept_ids == 321596,
                condition_concept_ids == 378253,
                condition_concept_ids == 312327,
                condition_concept_ids == 4170143,
                condition_concept_ids == 200219,
            ],
            [
                "Type 2 Diabetes",
                "Hypertension",
                "Depression",
                "Asthma",
                "Heart Attack",
                "Cough",
                "Headache",
                "Back Pain",
                "Chest Pain",
                "Pneumonia",
            ],
            default="Other Condition",
        )

        condition_source_concept_ids = np.where(
            np.random.random(total_conditions) < 0.8,  # 80% have source concept
            condition_concept_ids,  # Same as standard concept for simplicity
            None,
        )

        # Condition status
        condition_status_source_values = np.where(
            np.random.random(total_conditions) < 0.4,  # 40% have status
            np.random.choice(
                ["Active", "Resolved", "Inactive", "Chronic"], size=total_conditions
            ),
            None,
        )

        condition_status_concept_ids = np.where(
            condition_status_source_values == "Active",
            4230359,
            np.where(
                condition_status_source_values == "Resolved",
                4230360,
                np.where(
                    condition_status_source_values == "Inactive",
                    4262691,
                    np.where(
                        condition_status_source_values == "Chronic", 4052488, None
                    ),
                ),
            ),
        )

        return pd.DataFrame(
            {
                "CONDITION_OCCURRENCE_ID": condition_occurrence_ids,
                "PERSON_ID": person_ids,
                "CONDITION_CONCEPT_ID": condition_concept_ids,
                "CONDITION_START_DATE": [dt.date() for dt in condition_start_dates],
                "CONDITION_START_DATETIME": condition_start_datetimes,
                "CONDITION_END_DATE": condition_end_dates,
                "CONDITION_END_DATETIME": condition_end_datetimes,
                "CONDITION_TYPE_CONCEPT_ID": condition_type_concepts,
                "STOP_REASON": stop_reasons,
                "PROVIDER_ID": provider_ids,
                "VISIT_OCCURRENCE_ID": visit_occurrence_ids,
                "VISIT_DETAIL_ID": visit_detail_ids,
                "CONDITION_SOURCE_VALUE": condition_source_values,
                "CONDITION_SOURCE_CONCEPT_ID": condition_source_concept_ids,
                "CONDITION_STATUS_SOURCE_VALUE": condition_status_source_values,
                "CONDITION_STATUS_CONCEPT_ID": condition_status_concept_ids,
            }
        )

    def _mock_procedure_occurrence_table(self) -> pd.DataFrame:
        """
        Mock the PROCEDURE_OCCURRENCE table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked procedure occurrence table data
        """
        # Generate procedures for patients - use Poisson distribution for number of procedures per patient
        procedures_per_patient = np.random.poisson(
            lam=2.8, size=self.n_patients
        )  # Average 2-3 procedures per patient
        procedures_per_patient = np.clip(
            procedures_per_patient, 0, 15
        )  # Cap at 15 procedures

        total_procedures = procedures_per_patient.sum()

        # Generate procedure occurrence IDs that look realistic
        procedure_occurrence_ids = self._generate_realistic_ids(
            total_procedures, base=40000000
        )  # 8-digit IDs

        # Generate person IDs based on procedures per patient
        person_ids = np.repeat(self.base_patient_ids, procedures_per_patient)

        # Common procedure concept IDs (colonoscopy, mammography, blood tests, etc.)
        common_procedure_concepts = [
            4038534,  # Colonoscopy
            4037149,  # Mammography
            4267704,  # Complete blood count
            4039592,  # Electrocardiogram
            4267147,  # Blood glucose measurement
            4038863,  # CT scan of chest
            4037149,  # Chest X-ray
            4089442,  # Influenza vaccination
            4037302,  # MRI of brain
            4037640,  # Echocardiography
        ]
        procedure_concept_ids = np.random.choice(
            common_procedure_concepts, size=total_procedures
        )

        # Generate dates - procedure dates over last 10 years
        start_date = datetime(2014, 1, 1)
        end_date = datetime(2024, 12, 31)
        date_range = (end_date - start_date).days

        procedure_dates = [
            start_date + timedelta(days=int(np.random.uniform(0, date_range)))
            for _ in range(total_procedures)
        ]
        procedure_datetimes = [
            dt
            + timedelta(
                hours=np.random.randint(6, 18), minutes=np.random.randint(0, 60)
            )  # During business hours
            for dt in procedure_dates
        ]

        # Procedure type concept IDs (how procedure was recorded)
        procedure_type_concepts = np.random.choice(
            [
                32020,
                32817,
                32810,
                32879,
            ],  # EHR, Claim, Physical exam, Procedure billing code
            size=total_procedures,
            p=[0.5, 0.35, 0.1, 0.05],
        )

        # Optional fields with realistic presence rates
        modifier_concept_ids = np.where(
            np.random.random(total_procedures) < 0.15,  # 15% have modifier
            np.random.choice(
                [4052488, 4230359, 4262691], size=total_procedures
            ),  # Some procedure modifiers
            None,
        )

        # Quantity - most procedures are quantity 1, some have higher quantities
        quantities = np.where(
            np.random.random(total_procedures) < 0.85,  # 85% have quantity 1
            1,
            np.random.choice(
                [2, 3, 4, 5], size=total_procedures, p=[0.5, 0.3, 0.15, 0.05]
            ),
        )

        provider_ids = np.where(
            np.random.random(total_procedures) < 0.90,  # 90% have provider
            self._generate_realistic_ids(total_procedures, base=800000)[
                :total_procedures
            ],
            None,
        )

        visit_occurrence_ids = np.where(
            np.random.random(total_procedures) < 0.85,  # 85% associated with visit
            self._generate_realistic_ids(total_procedures, base=60000000)[
                :total_procedures
            ],
            None,
        )

        visit_detail_ids = np.where(
            np.random.random(total_procedures) < 0.25,  # 25% have visit detail
            np.random.choice(
                self._get_visit_detail_ids_pool(), size=total_procedures
            ),  # Use consistent IDs
            None,
        )

        # Source values - human readable procedure names
        procedure_source_values = np.select(
            [
                procedure_concept_ids == 4038534,
                procedure_concept_ids == 4037149,
                procedure_concept_ids == 4267704,
                procedure_concept_ids == 4039592,
                procedure_concept_ids == 4267147,
                procedure_concept_ids == 4038863,
                procedure_concept_ids == 4037149,
                procedure_concept_ids == 4089442,
                procedure_concept_ids == 4037302,
                procedure_concept_ids == 4037640,
            ],
            [
                "Colonoscopy",
                "Mammogram",
                "CBC",
                "EKG",
                "Blood glucose",
                "Chest CT",
                "Chest X-ray",
                "Flu shot",
                "Brain MRI",
                "Echo",
            ],
            default="Other Procedure",
        )

        procedure_source_concept_ids = np.where(
            np.random.random(total_procedures) < 0.75,  # 75% have source concept
            procedure_concept_ids,  # Same as standard concept for simplicity
            None,
        )

        # Modifier source values
        modifier_source_values = np.where(
            modifier_concept_ids.astype(str) != "None",
            np.random.choice(
                ["Bilateral", "Left", "Right", "Repeat"], size=total_procedures
            ),
            None,
        )

        return pd.DataFrame(
            {
                "PROCEDURE_OCCURRENCE_ID": procedure_occurrence_ids,
                "PERSON_ID": person_ids,
                "PROCEDURE_CONCEPT_ID": procedure_concept_ids,
                "PROCEDURE_DATE": [dt.date() for dt in procedure_dates],
                "PROCEDURE_DATETIME": procedure_datetimes,
                "PROCEDURE_TYPE_CONCEPT_ID": procedure_type_concepts,
                "MODIFIER_CONCEPT_ID": modifier_concept_ids,
                "QUANTITY": quantities,
                "PROVIDER_ID": provider_ids,
                "VISIT_OCCURRENCE_ID": visit_occurrence_ids,
                "VISIT_DETAIL_ID": visit_detail_ids,
                "PROCEDURE_SOURCE_VALUE": procedure_source_values,
                "PROCEDURE_SOURCE_CONCEPT_ID": procedure_source_concept_ids,
                "MODIFIER_SOURCE_VALUE": modifier_source_values,
            }
        )

    def _mock_death_table(self) -> pd.DataFrame:
        """
        Mock the DEATH table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked death table data
        """
        # Only a subset of patients will have death records (mortality rate)
        # Use age-stratified mortality - older patients more likely to have death records
        birth_years = np.random.choice(
            np.arange(1930, 2011),
            size=self.n_patients,
            p=self._generate_birth_year_probs(),
        )
        current_year = 2024
        ages = current_year - birth_years

        # Age-stratified death probability (very simplified)
        death_probs = np.where(
            ages < 50,
            0.005,  # 0.5% for under 50
            np.where(
                ages < 70,
                0.02,  # 2% for 50-70
                np.where(ages < 80, 0.08, 0.25),  # 8% for 70-80
            ),  # 25% for 80+
        )

        has_death = np.random.random(self.n_patients) < death_probs
        deceased_patient_ids = self.base_patient_ids[has_death]
        total_deaths = len(deceased_patient_ids)

        if total_deaths == 0:
            # Return empty DataFrame with correct schema
            return pd.DataFrame(
                {
                    "PERSON_ID": [],
                    "DEATH_DATE": [],
                    "DEATH_DATETIME": [],
                    "DEATH_TYPE_CONCEPT_ID": [],
                    "CAUSE_CONCEPT_ID": [],
                    "CAUSE_SOURCE_VALUE": [],
                    "CAUSE_SOURCE_CONCEPT_ID": [],
                }
            )

        # Generate death dates - deaths occur over last 5 years mainly
        start_date = datetime(2019, 1, 1)
        end_date = datetime(2024, 12, 31)
        date_range = (end_date - start_date).days

        death_dates = [
            start_date + timedelta(days=int(np.random.uniform(0, date_range)))
            for _ in range(total_deaths)
        ]
        death_datetimes = [
            dt
            + timedelta(
                hours=np.random.randint(0, 24), minutes=np.random.randint(0, 60)
            )
            for dt in death_dates
        ]

        # Death type concept IDs (how death was recorded)
        death_type_concepts = np.random.choice(
            [
                32817,
                32020,
                32879,
                32810,
            ],  # Claim, EHR, Procedure billing, Physical exam
            size=total_deaths,
            p=[0.4, 0.3, 0.2, 0.1],
        )

        # Common causes of death with OMOP concept IDs
        common_death_causes = [
            4329847,  # Myocardial infarction
            432867,  # Malignant neoplastic disease
            316866,  # Hypertensive disorder
            440383,  # Cerebrovascular accident
            200219,  # Pneumonia
            255848,  # Diabetes mellitus
            321596,  # Chronic obstructive lung disease
            374375,  # Renal failure
            434557,  # Sepsis
            0,  # Unknown/unspecified
        ]

        cause_concept_ids = np.where(
            np.random.random(total_deaths) < 0.85,  # 85% have cause recorded
            np.random.choice(
                common_death_causes[:-1],
                size=total_deaths,  # Exclude unknown for this 85%
                p=[0.25, 0.20, 0.10, 0.10, 0.08, 0.08, 0.07, 0.05, 0.07],
            ),  # 9 probabilities for 9 causes
            0,  # Unknown cause
        )

        # Cause source values - human readable causes
        cause_source_values = np.select(
            [
                cause_concept_ids == 4329847,
                cause_concept_ids == 432867,
                cause_concept_ids == 316866,
                cause_concept_ids == 440383,
                cause_concept_ids == 200219,
                cause_concept_ids == 255848,
                cause_concept_ids == 321596,
                cause_concept_ids == 374375,
                cause_concept_ids == 434557,
                cause_concept_ids == 0,
            ],
            [
                "Heart Attack",
                "Cancer",
                "Hypertension",
                "Stroke",
                "Pneumonia",
                "Diabetes",
                "COPD",
                "Kidney Failure",
                "Sepsis",
                "Unknown",
            ],
            default="Other",
        )

        # Set unknown causes to None for source values
        cause_source_values = np.where(
            cause_concept_ids == 0, None, cause_source_values
        )

        cause_source_concept_ids = np.where(
            (cause_concept_ids != 0)
            & (
                np.random.random(total_deaths) < 0.80
            ),  # 80% of non-unknown have source concept
            cause_concept_ids,  # Same as standard concept for simplicity
            None,
        )

        return pd.DataFrame(
            {
                "PERSON_ID": deceased_patient_ids,
                "DEATH_DATE": [dt.date() for dt in death_dates],
                "DEATH_DATETIME": death_datetimes,
                "DEATH_TYPE_CONCEPT_ID": death_type_concepts,
                "CAUSE_CONCEPT_ID": cause_concept_ids,
                "CAUSE_SOURCE_VALUE": cause_source_values,
                "CAUSE_SOURCE_CONCEPT_ID": cause_source_concept_ids,
            }
        )

    def _mock_drug_exposure_table(self) -> pd.DataFrame:
        """
        Mock the DRUG_EXPOSURE table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked drug exposure table data
        """
        # Generate drug exposures for patients - use Poisson distribution for number of drugs per patient
        drugs_per_patient = np.random.poisson(
            lam=4.2, size=self.n_patients
        )  # Average 4-5 drugs per patient
        drugs_per_patient = np.clip(drugs_per_patient, 0, 25)  # Cap at 25 drugs

        total_drugs = drugs_per_patient.sum()

        # Generate drug exposure IDs that look realistic
        drug_exposure_ids = self._generate_realistic_ids(
            total_drugs, base=80000000
        )  # 8-digit IDs

        # Generate person IDs based on drugs per patient
        person_ids = np.repeat(self.base_patient_ids, drugs_per_patient)

        # Common drug concept IDs (statins, ACE inhibitors, metformin, etc.)
        common_drug_concepts = [
            1539403,  # Atorvastatin
            1308216,  # Lisinopril
            1503297,  # Metformin
            1136980,  # Amlodipine
            1118084,  # Metoprolol
            19001065,  # Levothyroxine
            1124300,  # Omeprazole
            1777087,  # Simvastatin
            1386957,  # Hydrochlorothiazide
            40161532,  # Aspirin
        ]
        drug_concept_ids = np.random.choice(common_drug_concepts, size=total_drugs)

        # Generate dates - drug start dates over last 5 years
        start_date = datetime(2019, 1, 1)
        end_date = datetime(2024, 12, 31)
        date_range = (end_date - start_date).days

        drug_start_dates = [
            start_date + timedelta(days=int(np.random.uniform(0, date_range)))
            for _ in range(total_drugs)
        ]
        drug_start_datetimes = [
            dt
            + timedelta(
                hours=np.random.randint(8, 18), minutes=np.random.randint(0, 60)
            )  # During pharmacy hours
            for dt in drug_start_dates
        ]

        # End dates - 60% have end dates (acute treatments), 40% are ongoing (chronic)
        has_end_date = np.random.random(total_drugs) < 0.6
        drug_end_dates = []
        drug_end_datetimes = []
        verbatim_end_dates = []

        for i, has_end in enumerate(has_end_date):
            if has_end:
                # End date 7-365 days after start (with exponential distribution favoring shorter courses)
                days_duration = np.random.exponential(45)  # Average 45 days
                days_duration = max(
                    7, min(days_duration, 365)
                )  # Between 7 days and 1 year
                end_dt = drug_start_dates[i] + timedelta(days=int(days_duration))
                drug_end_dates.append(end_dt.date())
                drug_end_datetimes.append(
                    end_dt
                    + timedelta(
                        hours=np.random.randint(8, 18), minutes=np.random.randint(0, 60)
                    )
                )
                # 30% of drugs with end dates have verbatim end dates
                if np.random.random() < 0.3:
                    verbatim_end_dates.append(end_dt.date())
                else:
                    verbatim_end_dates.append(None)
            else:
                drug_end_dates.append(None)
                drug_end_datetimes.append(None)
                verbatim_end_dates.append(None)

        # Drug type concept IDs (how drug was prescribed/dispensed)
        drug_type_concepts = np.random.choice(
            [
                32817,
                32020,
                32879,
                581373,
            ],  # Claim, EHR, Procedure billing, Prescription written
            size=total_drugs,
            p=[0.5, 0.3, 0.1, 0.1],
        )

        # Optional fields with realistic presence rates
        stop_reasons = np.where(
            (np.array(drug_end_dates) != None)
            & (
                np.random.random(total_drugs) < 0.15
            ),  # 15% of ended drugs have stop reason
            np.random.choice(
                ["Completed course", "Side effects", "Ineffective", "Patient request"],
                size=total_drugs,
            ),
            None,
        )

        # Refills - most prescriptions have 0-5 refills
        refills = np.where(
            np.random.random(total_drugs) < 0.80,  # 80% have refill info
            np.random.choice(
                [0, 1, 2, 3, 5], size=total_drugs, p=[0.3, 0.25, 0.2, 0.15, 0.1]
            ),
            None,
        )

        # Quantity - realistic quantities for different drug types
        quantities = np.where(
            np.random.random(total_drugs) < 0.85,  # 85% have quantity
            np.random.choice(
                [30.0, 60.0, 90.0, 100.0, 120.0],
                size=total_drugs,
                p=[0.4, 0.25, 0.2, 0.1, 0.05],
            ),  # Common quantities
            None,
        )

        # Days supply
        days_supply = np.where(
            np.random.random(total_drugs) < 0.80,  # 80% have days supply
            np.random.choice([30, 60, 90], size=total_drugs, p=[0.6, 0.25, 0.15]),
            None,
        )

        # SIG (directions for use)
        sigs = np.where(
            np.random.random(total_drugs) < 0.70,  # 70% have sig
            np.random.choice(
                [
                    "Take 1 tablet by mouth daily",
                    "Take 1 tablet twice daily",
                    "Take 1 tablet as needed",
                    "Apply topically twice daily",
                    "Take 2 tablets daily",
                ],
                size=total_drugs,
                p=[0.4, 0.25, 0.15, 0.1, 0.1],
            ),
            None,
        )

        # Route concept IDs
        route_concept_ids = np.where(
            np.random.random(total_drugs) < 0.75,  # 75% have route
            np.random.choice(
                [4132161, 4161906, 4262099],
                size=total_drugs,  # Oral, Topical, Injection
                p=[0.85, 0.1, 0.05],
            ),
            None,
        )

        # Lot numbers - only small percentage have lot numbers
        lot_numbers = np.where(
            np.random.random(total_drugs) < 0.05,  # 5% have lot numbers
            [f"LOT{np.random.randint(100000, 999999)}" for _ in range(total_drugs)],
            None,
        )

        provider_ids = np.where(
            np.random.random(total_drugs) < 0.85,  # 85% have provider
            self._generate_realistic_ids(total_drugs, base=800000)[:total_drugs],
            None,
        )

        visit_occurrence_ids = np.where(
            np.random.random(total_drugs) < 0.70,  # 70% associated with visit
            self._generate_realistic_ids(total_drugs, base=60000000)[:total_drugs],
            None,
        )

        visit_detail_ids = np.where(
            np.random.random(total_drugs) < 0.20,  # 20% have visit detail
            np.random.choice(
                self._get_visit_detail_ids_pool(), size=total_drugs
            ),  # Use consistent IDs
            None,
        )

        # Source values - human readable drug names
        drug_source_values = np.select(
            [
                drug_concept_ids == 1539403,
                drug_concept_ids == 1308216,
                drug_concept_ids == 1503297,
                drug_concept_ids == 1136980,
                drug_concept_ids == 1118084,
                drug_concept_ids == 19001065,
                drug_concept_ids == 1124300,
                drug_concept_ids == 1777087,
                drug_concept_ids == 1386957,
                drug_concept_ids == 40161532,
            ],
            [
                "Atorvastatin 20mg",
                "Lisinopril 10mg",
                "Metformin 500mg",
                "Amlodipine 5mg",
                "Metoprolol 50mg",
                "Levothyroxine 50mcg",
                "Omeprazole 20mg",
                "Simvastatin 20mg",
                "HCTZ 25mg",
                "Aspirin 81mg",
            ],
            default="Other Medication",
        )

        drug_source_concept_ids = np.where(
            np.random.random(total_drugs) < 0.70,  # 70% have source concept
            drug_concept_ids,  # Same as standard concept for simplicity
            None,
        )

        # Route source values
        route_source_values = np.where(
            route_concept_ids.astype(str) != "None",
            np.select(
                [
                    route_concept_ids == 4132161,
                    route_concept_ids == 4161906,
                    route_concept_ids == 4262099,
                ],
                ["PO", "Topical", "IM"],
                default="Other",
            ),
            None,
        )

        # Dose unit source values
        dose_unit_source_values = np.where(
            np.random.random(total_drugs) < 0.60,  # 60% have dose unit
            np.random.choice(
                ["mg", "mcg", "mL", "units"], size=total_drugs, p=[0.7, 0.15, 0.1, 0.05]
            ),
            None,
        )

        return pd.DataFrame(
            {
                "DRUG_EXPOSURE_ID": drug_exposure_ids,
                "PERSON_ID": person_ids,
                "DRUG_CONCEPT_ID": drug_concept_ids,
                "DRUG_EXPOSURE_START_DATE": [dt.date() for dt in drug_start_dates],
                "DRUG_EXPOSURE_START_DATETIME": drug_start_datetimes,
                "DRUG_EXPOSURE_END_DATE": drug_end_dates,
                "DRUG_EXPOSURE_END_DATETIME": drug_end_datetimes,
                "VERBATIM_END_DATE": verbatim_end_dates,
                "DRUG_TYPE_CONCEPT_ID": drug_type_concepts,
                "STOP_REASON": stop_reasons,
                "REFILLS": refills,
                "QUANTITY": quantities,
                "DAYS_SUPPLY": days_supply,
                "SIG": sigs,
                "ROUTE_CONCEPT_ID": route_concept_ids,
                "LOT_NUMBER": lot_numbers,
                "PROVIDER_ID": provider_ids,
                "VISIT_OCCURRENCE_ID": visit_occurrence_ids,
                "VISIT_DETAIL_ID": visit_detail_ids,
                "DRUG_SOURCE_VALUE": drug_source_values,
                "DRUG_SOURCE_CONCEPT_ID": drug_source_concept_ids,
                "ROUTE_SOURCE_VALUE": route_source_values,
                "DOSE_UNIT_SOURCE_VALUE": dose_unit_source_values,
            }
        )

    def _get_visit_detail_ids_pool(self) -> np.ndarray:
        """
        Generate a pool of visit detail IDs that can be consistently referenced across tables.

        Returns:
            np.ndarray: Array of visit detail IDs
        """
        if self._visit_detail_ids_pool is None:
            # Generate enough visit details to handle Poisson distribution
            # Use 3x patients to ensure we have enough IDs for the Poisson distribution
            n_visit_details = int(self.n_patients * 3)
            self._visit_detail_ids_pool = self._generate_realistic_ids(
                n_visit_details, base=70000000
            )
        return self._visit_detail_ids_pool

    def _mock_visit_detail_table(self) -> pd.DataFrame:
        """
        Mock the VISIT_DETAIL table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked visit detail table data
        """
        # Generate visit details - some patients have multiple visit details, some have none
        visit_details_per_patient = np.random.poisson(
            lam=1.5, size=self.n_patients
        )  # Average 1.5 per patient
        visit_details_per_patient = np.clip(
            visit_details_per_patient, 0, 8
        )  # Cap at 8 visit details

        total_visit_details = visit_details_per_patient.sum()

        if total_visit_details == 0:
            # Return empty DataFrame with correct schema
            return pd.DataFrame(
                {
                    "VISIT_DETAIL_ID": [],
                    "PERSON_ID": [],
                    "VISIT_DETAIL_CONCEPT_ID": [],
                    "VISIT_DETAIL_START_DATE": [],
                    "VISIT_DETAIL_START_DATETIME": [],
                    "VISIT_DETAIL_END_DATE": [],
                    "VISIT_DETAIL_END_DATETIME": [],
                    "VISIT_DETAIL_TYPE_CONCEPT_ID": [],
                    "PROVIDER_ID": [],
                    "CARE_SITE_ID": [],
                    "ADMITTING_SOURCE_CONCEPT_ID": [],
                    "DISCHARGE_TO_CONCEPT_ID": [],
                    "PRECEDING_VISIT_DETAIL_ID": [],
                    "VISIT_DETAIL_SOURCE_VALUE": [],
                    "VISIT_DETAIL_SOURCE_CONCEPT_ID": [],
                    "ADMITTING_SOURCE_VALUE": [],
                    "DISCHARGE_TO_SOURCE_VALUE": [],
                    "VISIT_DETAIL_PARENT_ID": [],
                    "VISIT_OCCURRENCE_ID": [],
                }
            )

        # Use the pre-generated visit detail IDs
        visit_detail_ids = self._get_visit_detail_ids_pool()[:total_visit_details]

        # Generate person IDs based on visit details per patient
        person_ids = np.repeat(self.base_patient_ids, visit_details_per_patient)

        # Visit detail concept IDs (different types of visit details)
        visit_detail_concepts = np.random.choice(
            [
                581476,
                581477,
                32037,
            ],  # Emergency Room, Intensive Care Unit, Emergency Room and Inpatient
            size=total_visit_details,
            p=[0.6, 0.25, 0.15],
        )

        # Generate dates - visit detail dates over last 3 years
        start_date = datetime(2021, 1, 1)
        end_date = datetime(2024, 12, 31)
        date_range = (end_date - start_date).days

        visit_detail_start_dates = [
            start_date + timedelta(days=int(np.random.uniform(0, date_range)))
            for _ in range(total_visit_details)
        ]
        visit_detail_start_datetimes = [
            dt
            + timedelta(
                hours=np.random.randint(0, 24), minutes=np.random.randint(0, 60)
            )
            for dt in visit_detail_start_dates
        ]

        # End dates - all visit details have end dates
        # Duration varies by type: ER (hours), ICU (days), etc.
        visit_detail_end_dates = []
        visit_detail_end_datetimes = []

        for i, concept in enumerate(visit_detail_concepts):
            if concept == 581476:  # ER visit - typically hours
                hours_duration = np.random.exponential(4)  # Average 4 hours
                hours_duration = max(1, min(hours_duration, 24))  # Between 1-24 hours
            elif concept == 581477:  # ICU - typically days
                hours_duration = np.random.exponential(72)  # Average 3 days
                hours_duration = max(
                    6, min(hours_duration, 720)
                )  # Between 6 hours - 30 days
            else:  # Other - variable
                hours_duration = np.random.exponential(12)  # Average 12 hours
                hours_duration = max(
                    2, min(hours_duration, 168)
                )  # Between 2 hours - 7 days

            end_dt = visit_detail_start_datetimes[i] + timedelta(hours=hours_duration)
            visit_detail_end_dates.append(end_dt.date())
            visit_detail_end_datetimes.append(end_dt)

        # Visit detail type concept IDs (how visit detail was recorded)
        visit_detail_type_concepts = np.random.choice(
            [32817, 32020, 32810],  # Claim, EHR, Physical exam
            size=total_visit_details,
            p=[0.6, 0.35, 0.05],
        )

        # Optional fields with realistic presence rates
        provider_mask = (
            np.random.random(total_visit_details) < 0.90
        )  # 90% have provider
        provider_values = self._generate_realistic_ids(total_visit_details, base=800000)
        provider_ids = np.where(provider_mask, provider_values, None)

        care_site_mask = (
            np.random.random(total_visit_details) < 0.85
        )  # 85% have care site
        care_site_values = self._generate_realistic_ids(
            total_visit_details, base=300000
        )
        care_site_ids = np.where(care_site_mask, care_site_values, None)

        # Admitting source - only for inpatient-like visits
        admitting_mask = (visit_detail_concepts != 581476) & (
            np.random.random(total_visit_details) < 0.70
        )  # 70% of non-ER have admitting source
        admitting_values = np.random.choice(
            [8844, 8870, 8863], size=total_visit_details, p=[0.4, 0.4, 0.2]
        )  # Emergency Room, Physician Referral, Transfer
        admitting_source_concept_ids = np.where(admitting_mask, admitting_values, None)

        # Discharge to
        discharge_mask = (
            np.random.random(total_visit_details) < 0.80
        )  # 80% have discharge destination
        discharge_values = np.random.choice(
            [8536, 8844, 8717], size=total_visit_details, p=[0.7, 0.15, 0.15]
        )  # Home, Emergency Room, Skilled Nursing
        discharge_to_concept_ids = np.where(discharge_mask, discharge_values, None)

        # Preceding visit detail - 20% have preceding visit detail
        preceding_mask = np.random.random(total_visit_details) < 0.20
        preceding_values = np.random.choice(
            visit_detail_ids, size=total_visit_details
        )  # Reference other visit details
        preceding_visit_detail_ids = np.where(preceding_mask, preceding_values, None)

        # Source values
        visit_detail_source_values = np.select(
            [
                visit_detail_concepts == 581476,
                visit_detail_concepts == 581477,
                visit_detail_concepts == 32037,
            ],
            ["Emergency Room", "Intensive Care Unit", "Emergency and Inpatient"],
            default="Other Visit Detail",
        )

        visit_detail_source_concept_ids = np.where(
            np.random.random(total_visit_details) < 0.75,  # 75% have source concept
            visit_detail_concepts,
            None,
        )

        # Admitting/discharge source values
        admitting_source_values = np.where(
            admitting_source_concept_ids != None,
            np.select(
                [
                    admitting_source_concept_ids == 8844,
                    admitting_source_concept_ids == 8870,
                    admitting_source_concept_ids == 8863,
                ],
                ["Emergency Room", "Physician Referral", "Transfer"],
                default="Other",
            ),
            None,
        )

        discharge_to_source_values = np.where(
            discharge_to_concept_ids != None,
            np.select(
                [
                    discharge_to_concept_ids == 8536,
                    discharge_to_concept_ids == 8844,
                    discharge_to_concept_ids == 8717,
                ],
                ["Home", "Emergency Room", "Skilled Nursing"],
                default="Other",
            ),
            None,
        )

        # Parent visit detail - 30% have parent (hierarchical relationship)
        parent_mask = np.random.random(total_visit_details) < 0.30
        parent_values = np.random.choice(visit_detail_ids, size=total_visit_details)
        visit_detail_parent_ids = np.where(parent_mask, parent_values, None)

        # Visit occurrence IDs - all visit details should be associated with visit occurrences
        visit_occurrence_ids = self._generate_realistic_ids(
            total_visit_details, base=60000000
        )

        return pd.DataFrame(
            {
                "VISIT_DETAIL_ID": visit_detail_ids,
                "PERSON_ID": person_ids,
                "VISIT_DETAIL_CONCEPT_ID": visit_detail_concepts,
                "VISIT_DETAIL_START_DATE": [
                    dt.date() for dt in visit_detail_start_dates
                ],
                "VISIT_DETAIL_START_DATETIME": visit_detail_start_datetimes,
                "VISIT_DETAIL_END_DATE": visit_detail_end_dates,
                "VISIT_DETAIL_END_DATETIME": visit_detail_end_datetimes,
                "VISIT_DETAIL_TYPE_CONCEPT_ID": visit_detail_type_concepts,
                "PROVIDER_ID": provider_ids,
                "CARE_SITE_ID": care_site_ids,
                "ADMITTING_SOURCE_CONCEPT_ID": admitting_source_concept_ids,
                "DISCHARGE_TO_CONCEPT_ID": discharge_to_concept_ids,
                "PRECEDING_VISIT_DETAIL_ID": preceding_visit_detail_ids,
                "VISIT_DETAIL_SOURCE_VALUE": visit_detail_source_values,
                "VISIT_DETAIL_SOURCE_CONCEPT_ID": visit_detail_source_concept_ids,
                "ADMITTING_SOURCE_VALUE": admitting_source_values,
                "DISCHARGE_TO_SOURCE_VALUE": discharge_to_source_values,
                "VISIT_DETAIL_PARENT_ID": visit_detail_parent_ids,
                "VISIT_OCCURRENCE_ID": visit_occurrence_ids,
            }
        )

    def _mock_observation_table(self) -> pd.DataFrame:
        """
        Mock the OBSERVATION table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked observation table data
        """
        # Generate observations for patients - use Poisson distribution for number of observations per patient
        observations_per_patient = np.random.poisson(
            lam=6.5, size=self.n_patients
        )  # Average 6-7 observations per patient
        observations_per_patient = np.clip(
            observations_per_patient, 0, 30
        )  # Cap at 30 observations

        total_observations = observations_per_patient.sum()

        # Generate observation IDs that look realistic
        observation_ids = self._generate_realistic_ids(
            total_observations, base=90000000
        )  # 8-digit IDs

        # Generate person IDs based on observations per patient
        person_ids = np.repeat(self.base_patient_ids, observations_per_patient)

        # Common observation concept IDs (vital signs, lab values, survey responses, etc.)
        observation_concepts = [
            3025315,  # Body weight
            3013762,  # Body height
            3004249,  # Blood pressure systolic
            3012888,  # Blood pressure diastolic
            3027018,  # Heart rate
            3020891,  # Body temperature
            3024171,  # Respiratory rate
            3013940,  # BMI
            4083643,  # Smoking status
            4139618,  # Pain severity (0-10 scale)
        ]
        observation_concept_ids = np.random.choice(
            observation_concepts, size=total_observations
        )

        # Generate dates - observation dates over last 5 years
        start_date = datetime(2019, 1, 1)
        end_date = datetime(2024, 12, 31)
        date_range = (end_date - start_date).days

        observation_dates = [
            start_date + timedelta(days=int(np.random.uniform(0, date_range)))
            for _ in range(total_observations)
        ]
        observation_datetimes = [
            dt
            + timedelta(
                hours=np.random.randint(6, 20), minutes=np.random.randint(0, 60)
            )  # During clinic hours
            for dt in observation_dates
        ]

        # Observation type concept IDs (how observation was recorded)
        observation_type_concepts = np.random.choice(
            [
                32020,
                32817,
                32810,
                44818701,
            ],  # EHR, Claim, Physical exam, Patient reported
            size=total_observations,
            p=[0.5, 0.2, 0.2, 0.1],
        )

        # Generate values based on observation type - this is the complex part!
        value_as_numbers = []
        value_as_strings = []
        value_as_concept_ids = []
        unit_concept_ids = []
        unit_source_values = []

        for i, concept_id in enumerate(observation_concept_ids):
            if concept_id == 3025315:  # Body weight
                weight = np.random.normal(75, 15)  # kg, mean 75kg, std 15kg
                weight = max(30, min(weight, 200))  # Reasonable bounds
                value_as_numbers.append(weight)
                value_as_strings.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(9529)  # kilogram
                unit_source_values.append("kg")

            elif concept_id == 3013762:  # Body height
                height = np.random.normal(170, 10)  # cm, mean 170cm, std 10cm
                height = max(140, min(height, 220))  # Reasonable bounds
                value_as_numbers.append(height)
                value_as_strings.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8582)  # centimeter
                unit_source_values.append("cm")

            elif concept_id == 3004249:  # Systolic BP
                systolic = np.random.normal(130, 20)  # mmHg
                systolic = max(80, min(systolic, 200))
                value_as_numbers.append(systolic)
                value_as_strings.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8876)  # mmHg
                unit_source_values.append("mmHg")

            elif concept_id == 3012888:  # Diastolic BP
                diastolic = np.random.normal(80, 15)  # mmHg
                diastolic = max(50, min(diastolic, 120))
                value_as_numbers.append(diastolic)
                value_as_strings.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8876)  # mmHg
                unit_source_values.append("mmHg")

            elif concept_id == 3027018:  # Heart rate
                hr = np.random.normal(75, 15)  # bpm
                hr = max(40, min(hr, 150))
                value_as_numbers.append(hr)
                value_as_strings.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8541)  # per minute
                unit_source_values.append("bpm")

            elif concept_id == 3020891:  # Body temperature
                temp = np.random.normal(98.6, 1.5)  # Fahrenheit
                temp = max(95, min(temp, 105))
                value_as_numbers.append(temp)
                value_as_strings.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(586323)  # degree Fahrenheit
                unit_source_values.append("°F")

            elif concept_id == 3024171:  # Respiratory rate
                rr = np.random.normal(16, 4)  # breaths per minute
                rr = max(8, min(rr, 40))
                value_as_numbers.append(rr)
                value_as_strings.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8541)  # per minute
                unit_source_values.append("breaths/min")

            elif concept_id == 3013940:  # BMI
                bmi = np.random.normal(26, 5)  # kg/m2
                bmi = max(15, min(bmi, 50))
                value_as_numbers.append(bmi)
                value_as_strings.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(9531)  # kg/m2
                unit_source_values.append("kg/m²")

            elif concept_id == 4083643:  # Smoking status - categorical
                smoking_concepts = [
                    45879404,
                    45883458,
                    45884037,
                ]  # Current, Former, Never
                smoking_strings = ["Current smoker", "Former smoker", "Never smoker"]
                choice = np.random.choice([0, 1, 2], p=[0.15, 0.25, 0.60])
                value_as_numbers.append(None)
                value_as_strings.append(smoking_strings[choice])
                value_as_concept_ids.append(smoking_concepts[choice])
                unit_concept_ids.append(None)
                unit_source_values.append(None)

            elif concept_id == 4139618:  # Pain severity (0-10 scale)
                pain = np.random.choice(
                    range(11),
                    p=[0.3, 0.15, 0.15, 0.1, 0.1, 0.05, 0.05, 0.03, 0.03, 0.02, 0.02],
                )
                value_as_numbers.append(float(pain))
                value_as_strings.append(f"{pain}/10")
                value_as_concept_ids.append(None)
                unit_concept_ids.append(None)  # Scale has no unit
                unit_source_values.append("scale")

            else:  # Default case
                value_as_numbers.append(None)
                value_as_strings.append("Other observation")
                value_as_concept_ids.append(None)
                unit_concept_ids.append(None)
                unit_source_values.append(None)

        # Optional fields with realistic presence rates
        qualifier_concept_ids = np.where(
            np.random.random(total_observations) < 0.10,  # 10% have qualifiers
            np.random.choice(
                [4124457, 4124458], size=total_observations
            ),  # Normal, Abnormal
            None,
        )

        provider_ids = np.where(
            np.random.random(total_observations) < 0.85,  # 85% have provider
            self._generate_realistic_ids(total_observations, base=800000)[
                :total_observations
            ],
            None,
        )

        visit_occurrence_ids = np.where(
            np.random.random(total_observations) < 0.80,  # 80% associated with visit
            self._generate_realistic_ids(total_observations, base=60000000)[
                :total_observations
            ],
            None,
        )

        visit_detail_ids = np.where(
            np.random.random(total_observations) < 0.25,  # 25% have visit detail
            np.random.choice(
                self._get_visit_detail_ids_pool(), size=total_observations
            ),  # Use consistent IDs
            None,
        )

        # Source values - human readable observation names
        observation_source_values = np.select(
            [
                observation_concept_ids == 3025315,
                observation_concept_ids == 3013762,
                observation_concept_ids == 3004249,
                observation_concept_ids == 3012888,
                observation_concept_ids == 3027018,
                observation_concept_ids == 3020891,
                observation_concept_ids == 3024171,
                observation_concept_ids == 3013940,
                observation_concept_ids == 4083643,
                observation_concept_ids == 4139618,
            ],
            [
                "Weight",
                "Height",
                "Systolic BP",
                "Diastolic BP",
                "Heart Rate",
                "Temperature",
                "Respiratory Rate",
                "BMI",
                "Smoking Status",
                "Pain Score",
            ],
            default="Other Observation",
        )

        observation_source_concept_ids = np.where(
            np.random.random(total_observations) < 0.75,  # 75% have source concept
            observation_concept_ids,  # Same as standard concept for simplicity
            None,
        )

        # Qualifier source values
        qualifier_source_values = np.where(
            qualifier_concept_ids.astype(str) != "None",
            np.select(
                [qualifier_concept_ids == 4124457, qualifier_concept_ids == 4124458],
                ["Normal", "Abnormal"],
                default="Other",
            ),
            None,
        )

        return pd.DataFrame(
            {
                "OBSERVATION_ID": observation_ids,
                "PERSON_ID": person_ids,
                "OBSERVATION_CONCEPT_ID": observation_concept_ids,
                "OBSERVATION_DATE": [dt.date() for dt in observation_dates],
                "OBSERVATION_DATETIME": observation_datetimes,
                "OBSERVATION_TYPE_CONCEPT_ID": observation_type_concepts,
                "VALUE_AS_NUMBER": value_as_numbers,
                "VALUE_AS_STRING": value_as_strings,
                "VALUE_AS_CONCEPT_ID": value_as_concept_ids,
                "QUALIFIER_CONCEPT_ID": qualifier_concept_ids,
                "UNIT_CONCEPT_ID": unit_concept_ids,
                "PROVIDER_ID": provider_ids,
                "VISIT_OCCURRENCE_ID": visit_occurrence_ids,
                "VISIT_DETAIL_ID": visit_detail_ids,
                "OBSERVATION_SOURCE_VALUE": observation_source_values,
                "OBSERVATION_SOURCE_CONCEPT_ID": observation_source_concept_ids,
                "UNIT_SOURCE_VALUE": unit_source_values,
                "QUALIFIER_SOURCE_VALUE": qualifier_source_values,
            }
        )

    def _mock_observation_period_table(self) -> pd.DataFrame:
        """
        Mock the OBSERVATION_PERIOD table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked observation period table data
        """
        # Most patients have 1-3 observation periods (enrollment periods, gaps in coverage, etc.)
        periods_per_patient = np.random.choice(
            [1, 2, 3], size=self.n_patients, p=[0.6, 0.3, 0.1]
        )
        total_periods = periods_per_patient.sum()

        # Generate observation period IDs that look realistic
        observation_period_ids = self._generate_realistic_ids(
            total_periods, base=10000000
        )  # 8-digit IDs

        # Generate person IDs based on periods per patient
        person_ids = np.repeat(self.base_patient_ids, periods_per_patient)

        # Generate observation periods - these should cover the timeframe of other events
        # Most periods start 2010-2020 and many are still ongoing or end recently
        start_date = datetime(2010, 1, 1)
        end_date = datetime(2020, 1, 1)
        start_date_range = (end_date - start_date).days

        observation_start_dates = []
        observation_end_dates = []

        # Track which patient we're on to create non-overlapping periods for same patient
        current_patient_idx = 0
        current_patient_id = person_ids[0] if total_periods > 0 else None
        last_end_date = None

        for i in range(total_periods):
            # Check if we've moved to a new patient
            if person_ids[i] != current_patient_id:
                current_patient_id = person_ids[i]
                current_patient_idx = 0
                last_end_date = None

            if current_patient_idx == 0:
                # First period for this patient - start randomly between 2010-2020
                period_start = start_date + timedelta(
                    days=int(np.random.uniform(0, start_date_range))
                )
            else:
                # Subsequent period - start after previous period ended (with possible gap)
                if last_end_date:
                    gap_days = np.random.exponential(180)  # Average 6 month gap
                    gap_days = max(30, min(gap_days, 1095))  # 1 month to 3 years gap
                    period_start = last_end_date + timedelta(days=int(gap_days))
                else:
                    # Fallback if something went wrong
                    period_start = start_date + timedelta(
                        days=int(np.random.uniform(0, start_date_range))
                    )

            observation_start_dates.append(period_start.date())

            # Generate end date
            # 70% of periods are ongoing (end in 2024-2025), 30% ended earlier
            if np.random.random() < 0.7:
                # Ongoing - end in 2024-2025
                ongoing_start = datetime(2024, 1, 1)
                ongoing_end = datetime(2025, 12, 31)
                ongoing_range = (ongoing_end - ongoing_start).days
                period_end = ongoing_start + timedelta(
                    days=int(np.random.uniform(0, ongoing_range))
                )
            else:
                # Ended - duration varies (6 months to 10 years)
                duration_days = np.random.exponential(1095)  # Average 3 years
                duration_days = max(
                    180, min(duration_days, 3650)
                )  # 6 months to 10 years
                period_end = period_start + timedelta(days=int(duration_days))

                # Make sure end date isn't in the future
                if period_end > datetime.now():
                    period_end = datetime.now() - timedelta(
                        days=np.random.randint(30, 365)
                    )

            observation_end_dates.append(period_end.date())
            last_end_date = period_end
            current_patient_idx += 1

        # Period type concept IDs (how the observation period was determined)
        period_type_concepts = np.random.choice(
            [
                32817,
                44814722,
                44814723,
                32020,
            ],  # Insurance enrollment, EHR enrollment period, Registry enrollment, EHR
            size=total_periods,
            p=[0.5, 0.25, 0.15, 0.1],
        )

        return pd.DataFrame(
            {
                "OBSERVATION_PERIOD_ID": observation_period_ids,
                "PERSON_ID": person_ids,
                "OBSERVATION_PERIOD_START_DATE": observation_start_dates,
                "OBSERVATION_PERIOD_END_DATE": observation_end_dates,
                "PERIOD_TYPE_CONCEPT_ID": period_type_concepts,
            }
        )

    def _mock_measurement_table(self) -> pd.DataFrame:
        """
        Mock the MEASUREMENT table with OMOP schema.

        Returns:
            pd.DataFrame: Mocked measurement table data
        """
        # Generate measurements for patients - use Poisson distribution for number of measurements per patient
        measurements_per_patient = np.random.poisson(
            lam=8.5, size=self.n_patients
        )  # Average 8-9 measurements per patient
        measurements_per_patient = np.clip(
            measurements_per_patient, 0, 40
        )  # Cap at 40 measurements

        total_measurements = measurements_per_patient.sum()

        # Generate measurement IDs that look realistic
        measurement_ids = self._generate_realistic_ids(
            total_measurements, base=100000000
        )  # 9-digit IDs

        # Generate person IDs based on measurements per patient
        person_ids = np.repeat(self.base_patient_ids, measurements_per_patient)

        # Common measurement concept IDs (lab tests, vital signs, etc.)
        measurement_concepts = [
            3004410,  # Hemoglobin
            3019550,  # Hematocrit
            3013650,  # White blood cell count
            3024561,  # Serum glucose
            3027114,  # Serum creatinine
            3006906,  # Total cholesterol
            3007220,  # HDL cholesterol
            3028437,  # LDL cholesterol
            3022217,  # Triglycerides
            3019832,  # Hemoglobin A1c
        ]
        measurement_concept_ids = np.random.choice(
            measurement_concepts, size=total_measurements
        )

        # Generate dates - measurement dates over last 5 years
        start_date = datetime(2019, 1, 1)
        end_date = datetime(2024, 12, 31)
        date_range = (end_date - start_date).days

        measurement_dates = [
            start_date + timedelta(days=int(np.random.uniform(0, date_range)))
            for _ in range(total_measurements)
        ]
        measurement_datetimes = [
            dt
            + timedelta(
                hours=np.random.randint(6, 18), minutes=np.random.randint(0, 60)
            )  # During lab hours
            for dt in measurement_dates
        ]

        # Measurement times (string format like "08:30")
        measurement_times = [
            f"{dt.hour:02d}:{dt.minute:02d}" for dt in measurement_datetimes
        ]

        # Measurement type concept IDs (how measurement was performed)
        measurement_type_concepts = np.random.choice(
            [32817, 32020, 44818702, 32810],  # Claim, EHR, Lab result, Physical exam
            size=total_measurements,
            p=[0.3, 0.4, 0.25, 0.05],
        )

        # Generate values, units, and ranges based on measurement type
        value_as_numbers = []
        value_as_concept_ids = []
        unit_concept_ids = []
        unit_source_values = []
        range_lows = []
        range_highs = []
        operator_concept_ids = []
        measurement_source_values = []
        value_source_values = []

        for i, concept_id in enumerate(measurement_concept_ids):
            if concept_id == 3004410:  # Hemoglobin
                hgb = np.random.normal(13.5, 2.0)  # g/dL
                hgb = max(6.0, min(hgb, 20.0))
                value_as_numbers.append(hgb)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8713)  # g/dL
                unit_source_values.append("g/dL")
                range_lows.append(12.0)
                range_highs.append(16.0)
                measurement_source_values.append("Hemoglobin")
                value_source_values.append(f"{hgb:.1f}")

            elif concept_id == 3019550:  # Hematocrit
                hct = np.random.normal(42, 6)  # %
                hct = max(20, min(hct, 60))
                value_as_numbers.append(hct)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8554)  # %
                unit_source_values.append("%")
                range_lows.append(36.0)
                range_highs.append(48.0)
                measurement_source_values.append("Hematocrit")
                value_source_values.append(f"{hct:.1f}")

            elif concept_id == 3013650:  # White blood cell count
                wbc = np.random.lognormal(2.0, 0.5)  # 10^3/uL
                wbc = max(1.0, min(wbc, 20.0))
                value_as_numbers.append(wbc)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8848)  # 10^3/uL
                unit_source_values.append("K/uL")
                range_lows.append(4.5)
                range_highs.append(11.0)
                measurement_source_values.append("WBC")
                value_source_values.append(f"{wbc:.2f}")

            elif concept_id == 3024561:  # Serum glucose
                # Bimodal: fasting (80-100) vs random/diabetic (higher)
                if np.random.random() < 0.6:  # 60% fasting levels
                    glucose = np.random.normal(90, 10)
                    glucose = max(70, min(glucose, 120))
                else:  # 40% random/elevated levels
                    glucose = np.random.lognormal(4.8, 0.4)
                    glucose = max(100, min(glucose, 400))
                value_as_numbers.append(glucose)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8840)  # mg/dL
                unit_source_values.append("mg/dL")
                range_lows.append(70.0)
                range_highs.append(100.0)
                measurement_source_values.append("Glucose")
                value_source_values.append(f"{glucose:.0f}")

            elif concept_id == 3027114:  # Serum creatinine
                creat = np.random.lognormal(0.0, 0.3)  # mg/dL
                creat = max(0.5, min(creat, 5.0))
                value_as_numbers.append(creat)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8840)  # mg/dL
                unit_source_values.append("mg/dL")
                range_lows.append(0.7)
                range_highs.append(1.3)
                measurement_source_values.append("Creatinine")
                value_source_values.append(f"{creat:.2f}")

            elif concept_id == 3006906:  # Total cholesterol
                chol = np.random.normal(200, 40)  # mg/dL
                chol = max(100, min(chol, 400))
                value_as_numbers.append(chol)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8840)  # mg/dL
                unit_source_values.append("mg/dL")
                range_lows.append(None)  # No standard low range
                range_highs.append(200.0)
                measurement_source_values.append("Total Cholesterol")
                value_source_values.append(f"{chol:.0f}")

            elif concept_id == 3007220:  # HDL cholesterol
                hdl = np.random.normal(50, 15)  # mg/dL
                hdl = max(20, min(hdl, 100))
                value_as_numbers.append(hdl)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8840)  # mg/dL
                unit_source_values.append("mg/dL")
                range_lows.append(40.0)
                range_highs.append(None)  # No standard high range
                measurement_source_values.append("HDL")
                value_source_values.append(f"{hdl:.0f}")

            elif concept_id == 3028437:  # LDL cholesterol
                ldl = np.random.normal(130, 35)  # mg/dL
                ldl = max(50, min(ldl, 300))
                value_as_numbers.append(ldl)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8840)  # mg/dL
                unit_source_values.append("mg/dL")
                range_lows.append(None)  # No standard low range
                range_highs.append(100.0)
                measurement_source_values.append("LDL")
                value_source_values.append(f"{ldl:.0f}")

            elif concept_id == 3022217:  # Triglycerides
                trig = np.random.lognormal(4.5, 0.5)  # mg/dL
                trig = max(50, min(trig, 500))
                value_as_numbers.append(trig)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8840)  # mg/dL
                unit_source_values.append("mg/dL")
                range_lows.append(None)  # No standard low range
                range_highs.append(150.0)
                measurement_source_values.append("Triglycerides")
                value_source_values.append(f"{trig:.0f}")

            elif concept_id == 3019832:  # Hemoglobin A1c
                a1c = np.random.lognormal(1.8, 0.3)  # %
                a1c = max(4.0, min(a1c, 15.0))
                value_as_numbers.append(a1c)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(8554)  # %
                unit_source_values.append("%")
                range_lows.append(4.0)
                range_highs.append(5.6)
                measurement_source_values.append("Hemoglobin A1c")
                value_source_values.append(f"{a1c:.1f}")

            else:  # Default case
                value_as_numbers.append(None)
                value_as_concept_ids.append(None)
                unit_concept_ids.append(None)
                unit_source_values.append(None)
                range_lows.append(None)
                range_highs.append(None)
                measurement_source_values.append("Other Measurement")
                value_source_values.append(None)

            # Operator concepts - 10% have operators like >, <, >=
            if np.random.random() < 0.10:
                operator_concept_ids.append(
                    np.random.choice([4172703, 4171754, 4171755])
                )  # >, <, >=
            else:
                operator_concept_ids.append(None)

        # Optional fields with realistic presence rates
        provider_ids = np.where(
            np.random.random(total_measurements) < 0.80,  # 80% have provider
            self._generate_realistic_ids(total_measurements, base=800000)[
                :total_measurements
            ],
            None,
        )

        visit_occurrence_ids = np.where(
            np.random.random(total_measurements) < 0.75,  # 75% associated with visit
            self._generate_realistic_ids(total_measurements, base=60000000)[
                :total_measurements
            ],
            None,
        )

        visit_detail_ids = np.where(
            np.random.random(total_measurements) < 0.20,  # 20% have visit detail
            np.random.choice(
                self._get_visit_detail_ids_pool(), size=total_measurements
            ),  # Use consistent IDs
            None,
        )

        measurement_source_concept_ids = np.where(
            np.random.random(total_measurements) < 0.80,  # 80% have source concept
            measurement_concept_ids,  # Same as standard concept for simplicity
            None,
        )

        return pd.DataFrame(
            {
                "MEASUREMENT_ID": measurement_ids,
                "PERSON_ID": person_ids,
                "MEASUREMENT_CONCEPT_ID": measurement_concept_ids,
                "MEASUREMENT_DATE": [dt.date() for dt in measurement_dates],
                "MEASUREMENT_DATETIME": measurement_datetimes,
                "MEASUREMENT_TIME": measurement_times,
                "MEASUREMENT_TYPE_CONCEPT_ID": measurement_type_concepts,
                "OPERATOR_CONCEPT_ID": operator_concept_ids,
                "VALUE_AS_NUMBER": value_as_numbers,
                "VALUE_AS_CONCEPT_ID": value_as_concept_ids,
                "UNIT_CONCEPT_ID": unit_concept_ids,
                "RANGE_LOW": range_lows,
                "RANGE_HIGH": range_highs,
                "PROVIDER_ID": provider_ids,
                "VISIT_OCCURRENCE_ID": visit_occurrence_ids,
                "VISIT_DETAIL_ID": visit_detail_ids,
                "MEASUREMENT_SOURCE_VALUE": measurement_source_values,
                "MEASUREMENT_SOURCE_CONCEPT_ID": measurement_source_concept_ids,
                "UNIT_SOURCE_VALUE": unit_source_values,
                "VALUE_SOURCE_VALUE": value_source_values,
            }
        )

    def get_source_tables(self) -> Dict[str, pd.DataFrame]:
        """
        Get mocked source tables (raw database tables before PhenEx mapping).

        Returns the exact same data on multiple calls for consistency.

        Returns:
            Dict[str, pd.DataFrame]: Dictionary of source table names to DataFrames
        """
        # Return cached tables if they exist
        if self._cached_source_tables is not None:
            return self._cached_source_tables

        # Generate tables for the first time
        source_tables = {}
        # Get unique source table names from the domains dictionary
        unique_source_tables = set(
            mapper.NAME_TABLE for mapper in self.domains_dict.domains_dict.values()
        )

        for table_name in unique_source_tables:
            if table_name == "PERSON":
                source_tables[table_name] = ibis.memtable(self._mock_person_table())
            elif table_name == "CONDITION_OCCURRENCE":
                source_tables[table_name] = ibis.memtable(
                    self._mock_condition_occurrence_table()
                )
            elif table_name == "PROCEDURE_OCCURRENCE":
                source_tables[table_name] = ibis.memtable(
                    self._mock_procedure_occurrence_table()
                )
            elif table_name == "DEATH":
                source_tables[table_name] = ibis.memtable(self._mock_death_table())
            elif table_name == "DRUG_EXPOSURE":
                source_tables[table_name] = ibis.memtable(
                    self._mock_drug_exposure_table()
                )
            elif table_name == "VISIT_DETAIL":
                source_tables[table_name] = ibis.memtable(
                    self._mock_visit_detail_table()
                )
            elif table_name == "OBSERVATION":
                source_tables[table_name] = ibis.memtable(
                    self._mock_observation_table()
                )
            elif table_name == "OBSERVATION_PERIOD":
                source_tables[table_name] = ibis.memtable(
                    self._mock_observation_period_table()
                )
            elif table_name == "MEASUREMENT":
                source_tables[table_name] = ibis.memtable(
                    self._mock_measurement_table()
                )
            # TODO: Add other table mocking as needed
            # etc.

        # Cache the tables for future calls
        self._cached_source_tables = source_tables
        return source_tables

    def get_mapped_tables(self) -> Dict[str, PhenexTable]:
        """
        Get mocked tables mapped to PhenEx representation.

        This mimics the behavior of DomainsDictionary.get_mapped_tables() but with mocked data.

        Returns:
            Dict[str, PhenexTable]: Dictionary of domain names to PhenexTable instances
        """
        source_tables = self.get_source_tables()
        mapped_tables = {}

        for domain, mapper in self.domains_dict.domains_dict.items():
            source_table_name = mapper.NAME_TABLE
            if source_table_name in source_tables:
                mapped_tables[domain] = mapper(source_tables[source_table_name])

        return mapped_tables
