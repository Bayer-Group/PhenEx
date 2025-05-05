export enum Mapper {
  OMOP = 'OMOP',
  OPTUM_EHR = 'Optum EHR',
  OPTUM_CLAIMS = 'Optum Claims',
  CPRD_AURUM = 'CPRD Aurum',
}

export interface DomainInfo {
  name: string;
  info: string;
}

export const MapperDomains: Record<Mapper, DomainInfo[]> = {
  [Mapper.OMOP]: [
    {
      name: 'CONDITION_OCCURRENCE',
      info: 'For medical conditions, diagnoses using the OMOP transformed data i.e. SNOMED codes.',
    },
    {
      name: 'CONDITION_OCCURRENCE_SOURCE',
      info: 'For medical conditions, diagnoses using the raw source values. Use if codelists are from source data code types, for example ICD10CM or ICD9CM.',
    },
    {
      name: 'PROCEDURE_OCCURRENCE',
      info: 'For medical procedures, surgeries, and interventions performed on patients using the OMOP transformed data i.e. SNOMED codes.',
    },
    {
      name: 'PROCEDURE_OCCURRENCE_SOURCE',
      info: 'For medical procedures, surgeries, and interventions using the raw source values. Use if codelists are from source data code types, for example CPT or ICD10PCS.',
    },
    {
      name: 'DRUG_EXPOSURE',
      info: 'For medication prescriptions, drug exposures, and pharmaceutical treatments using the OMOP transformed data i.e. RxNorm codes.',
    },
    {
      name: 'DRUG_EXPOSURE_SOURCE',
      info: 'For medication prescriptions, drug exposures, and pharmaceutical treatments using the raw source values. Use if codelists are from source data code types, for example NDC',
    },
    {
      name: 'PERSON',
      info: 'For demographic information, for example date of birth, ethnicity, sex using OMOP transformed data',
    },
    {
      name: 'PERSON_SOURCE',
      info: 'For demographic information, for example date of birth, ethnicity, sex using raw source data values',
    },
    { name: 'DEATH', info: 'For usage with DeathPhenotype' },
    { name: 'VISIT_DETAIL', info: 'Contains additional information pertaining to encounters.' },
    { name: 'OBSERVATION_PERIOD', info: 'For usage with ContinuousCoveragePhenotype.' },
  ],
  [Mapper.OPTUM_EHR]: [
    {
      name: 'DIAGNOSIS',
      info: 'For medical conditions, diagnoses, and health problems recorded in clinical settings.',
    },
    {
      name: 'DRUG',
      info: 'For medication prescriptions, drug exposures, and pharmaceutical treatments.',
    },
    {
      name: 'PROCEDURE',
      info: 'For medical procedures, surgeries, and interventions performed on patients.',
    },
    {
      name: 'OBSERVATION',
      info: 'For clinical observations, vital signs, and general patient measurements.',
    },
    {
      name: 'LAB',
      info: 'For laboratory tests, diagnostic measurements, and quantitative clinical results.',
    },
  ],
  [Mapper.OPTUM_CLAIMS]: [
    {
      name: 'ConditionDomain',
      info: 'For medical conditions, diagnoses, and health problems recorded in clinical settings.',
    },
    {
      name: 'DrugDomain',
      info: 'For medication prescriptions, drug exposures, and pharmaceutical treatments.',
    },
    {
      name: 'ProcedureDomain',
      info: 'For medical procedures, surgeries, and interventions performed on patients.',
    },
    {
      name: 'ObservationDomain',
      info: 'For clinical observations, vital signs, and general patient measurements.',
    },
    {
      name: 'MeasurementDomain',
      info: 'For laboratory tests, diagnostic measurements, and quantitative clinical results.',
    },
  ],
  [Mapper.CPRD_AURUM]: [
    {
      name: 'ConditionDomain',
      info: 'For medical conditions, diagnoses, and health problems recorded in clinical settings.',
    },
    {
      name: 'DrugDomain',
      info: 'For medication prescriptions, drug exposures, and pharmaceutical treatments.',
    },
    {
      name: 'ProcedureDomain',
      info: 'For medical procedures, surgeries, and interventions performed on patients.',
    },
    {
      name: 'ObservationDomain',
      info: 'For clinical observations, vital signs, and general patient measurements.',
    },
    {
      name: 'MeasurementDomain',
      info: 'For laboratory tests, diagnostic measurements, and quantitative clinical results.',
    },
  ],
};
