export enum PhenotypeType {
  Entry = 'entry',
  Inclusion = 'inclusion',
  Exclusion = 'exclusion',
  Baseline = 'baseline',
  Outcome = 'outcome'
}

export const PhenotypeTypeNames: Record<PhenotypeType, string> = {
  [PhenotypeType.Entry]: 'Entry',
  [PhenotypeType.Inclusion]: 'Inclusion',
  [PhenotypeType.Exclusion]: 'Exclusion',
  [PhenotypeType.Baseline]: 'Baseline',
  [PhenotypeType.Outcome]: 'Outcome'
};

export const phenotypeTypeValues = Object.values(PhenotypeType);