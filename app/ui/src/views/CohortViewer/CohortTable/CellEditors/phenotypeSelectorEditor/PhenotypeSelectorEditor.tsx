import React from 'react';
import styles from './PhenotypeSelectorEditor.module.css';
import { ItemList } from '../../../../../components/ItemList/ItemList'; // adjust path as needed
import typeStyles from '../../../../../styles/study_types.module.css';

export interface PhenotypeSelectorEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

// const phenotypes = [
//   {
//     name: 'CodelistPhenotype',
//     info: 'For lists of medical codes (ICD, NDC, CPT, etc). For example, identify patients with a diagnosis of a particular disease or a prescription of a particular medication.',
//   },
//   {
//     name: 'MeasurementPhenotype',
//     info: 'For numerical values, for example observation or laboratory events such as height, weight, blood pressure, or hBA1c.',
//   },
//   {
//     name: 'CategoricalPhenotype',
//     info: 'For categorical values, for example ethnicity, sex, or hospitalization',
//   },
//   {
//     name: 'TimeRangePhenotype',
//     info: 'For observation period data. Identify patients with continuous periods of insurance or healthcare coverage.',
//   },
//   {
//     name: 'AgePhenotype',
//     info: 'For birth date data and corresponding calculations to determine age at a particular point in time.',
//   },
//   { name: 'DeathPhenotype', info: 'For death date data. Identify patients who have died.' },

//   {
//     name: 'LogicPhenotype',
//     info: 'For combining multiple phenotypes using logical operators such as AND, OR, NOT. Use when data from multiple data dimensions is desired. For example, mild liver disease is defined as a diagnosis code OR a ALT/AST lab value below a certain threshold.',
//   },
//   {
//     name: 'ScorePhenotype',
//     info: 'For the calculation of medical scores such as CHADSVASC, HASBLED, or Charlson Comorbidity Index. Combine multiple phenotypes using addition, subtraction and integer multiplication.',
//   },
//   {
//     name: 'ArithmeticPhenotype',
//     info: 'For the calculation of numerical values using other numerical values. For example, use this to calculate BMI using height and weight values found in the data.',
//   },
//   {
//     name: 'EventCountPhenotype',
//     info: 'Counts number of distinct days a phenotype occurs; filter patients based on number of days an event occurs, and the number of days between any two events',
//   },
//   {
//     name: 'BinPhenotype',
//     info: 'For converting a numerically valued phenotype to categorical bins. Specify which bins you want to use.',
//   },
//   {
//     name: 'MeasurementChange',
//     info: 'For identifying changes in a numerical value e.g. drop of Hb of 2 g/dL over 2 days',
//   },
// ];
const phenotypes = [
  {
    name: 'CodelistPhenotype',
    info: '',
  },
  {
    name: 'MeasurementPhenotype',
    info: '',
  },
  {
    name: 'CategoricalPhenotype',
    info: '',
  },
  {
    name: 'TimeRangePhenotype',
    info: '',
  },
  {
    name: 'AgePhenotype',
    info: '',
  },
  { name: 'DeathPhenotype', 
    info: '',
  },

  {
    name: 'LogicPhenotype',
    info: '',
  },
  {
    name: 'ScorePhenotype',
    info: '',
  },
  {
    name: 'ArithmeticPhenotype',
    info: '',
  },
  {
    name: 'EventCountPhenotype',
    info: '',
  },
  {
    name: 'BinPhenotype',
    info: '',
  },
  {
    name: 'MeasurementChange',
    info: '',
  },
];


export const PhenotypeSelectorEditor: React.FC<PhenotypeSelectorEditorProps> = props => {
  const [selectedPhenotype, setSelectedPhenotype] = React.useState<string | null>(
    props.value || null
  );

  const handlePhenotypeSelect = (phenotypeName: string) => {
    setSelectedPhenotype(phenotypeName);
    props.onValueChange?.(phenotypeName);
  };

  return (
    <div className={styles.container}>
      <ItemList
        items={phenotypes}
        selectedName={selectedPhenotype || undefined}
        onSelect={handlePhenotypeSelect}
        classNameListItem={styles.listItem}
        classNameListItemSelected={styles.listItemSelected}
        // classNameListItem={typeStyles[`${props.data?.effective_type}_list_item`]}
        // classNameListItemSelected={`${typeStyles[`${props.data?.effective_type}_list_item_selected`]}`}
      />
    </div>
  );
};
