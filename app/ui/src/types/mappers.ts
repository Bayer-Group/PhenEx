export enum Mapper {
  OMOP = 'OMOP',
  OPTUM_EHR = 'Optum EHR',
  OPTUM_CLAIMS = 'Optum Claims',
  CPRD_AURUM = 'CPRD Aurum',
}

export const MapperDomains: Record<Mapper, string[]> = {
  [Mapper.OMOP]: [
    'Condition Occurrence',
    'Drug Exposure',
    'Procedure Occurrence',
    'Person',
    'Observation Period',
  ],
  [Mapper.OPTUM_EHR]: ['Diagnosis', 'Medication', 'Procedure', 'Patient', 'Observation'],
  [Mapper.OPTUM_CLAIMS]: ['Diagnosis', 'Medication', 'Procedure', 'Patient', 'Observation'],
  [Mapper.CPRD_AURUM]: [
    'Condition Occurrence',
    'Drug Exposure',
    'Procedure Occurrence',
    'Person',
    'Observation',
  ],
};
