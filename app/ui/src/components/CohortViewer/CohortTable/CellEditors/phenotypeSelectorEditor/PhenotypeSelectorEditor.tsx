import React from 'react';
import styles from './PhenotypeSelectorEditor.module.css';

export interface PhenotypeSelectorEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

const phenotypes =  [
  {name:'CodelistPhenotype', info:"For lists of medical codes (ICD, NDC, CPT, etc). For example, identify patients with a diagnosis of a particular disease or a prescription of a particular medication."},
  {name:'MeasurementPhenotype', info:"For numerical values, for example observation or laboratory events such as height, weight, blood pressure, or hBA1c."},
  {name:'CategoricalPhenotype', info:"For categorical values, for example ethnicity, sex, or hospitalization"},
  {name:'ContinuousCoveragePhenotype', info:"For observation period data. Identify patients with continuous periods of insurance or healthcare coverage."},
  {name:'AgePhenotype', info:"For birth date data and corresponding calculations to determine age at a particular point in time."},
  {name:'DeathPhenotype', info:"For death date data. Identify patients who have died."},

  {name:'LogicPhenotype', info:"For combining multiple phenotypes using logical operators such as AND, OR, NOT. Use when data from multiple data dimensions is desired. For example, mild liver disease is defined as a diagnosis code OR a ALT/AST lab value below a certain threshold."},
  {name:'ScorePhenotype', info:"For the calculation of medical scores such as CHADSVASC, HASBLED, or Charlson Comorbidity Index. Combine multiple phenotypes using addition, subtraction and integer multiplication."},
  {name:'ArithmeticPhenotype', info:"For the calculation of numerical values using other numerical values. For example, use this to calculate BMI using height and weight values found in the data."},
]

export const PhenotypeSelectorEditor: React.FC<PhenotypeSelectorEditorProps> = (props) => {
  const [selectedPhenotype, setSelectedPhenotype] = React.useState<string | null>(props.value || null);

  const handlePhenotypeSelect = (phenotypeName: string) => {
    setSelectedPhenotype(phenotypeName);
    props.onValueChange?.(phenotypeName);
  };

  return (
    <div className={styles.container}>
      {phenotypes.map((phenotype) => (
        <div
          key={phenotype.name}
          className={`${styles.phenotypeSection} ${selectedPhenotype === phenotype.name ? styles.selected : ''}`}
          onClick={() => handlePhenotypeSelect(phenotype.name)}
        >
          <div className={styles.phenotypeName}>{phenotype.name.replace('Phenotype', '')}</div>
          <p className={styles.phenotypeInfo}>{phenotype.info}</p>
        </div>
      ))}
    </div>
  );
};