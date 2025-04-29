import React from 'react';
import styles from './TypeSelectorEditor.module.css';

export interface TypeSelectorEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

const types = [
  {name: 'entry', info: 'Entry Criterion - Define the initial population for your cohort'},
  {name: 'inclusion', info: 'Inclusion Criterion - Specify conditions that must be met for patients to be included in the cohort'},
  {name: 'exclusion', info: 'Exclusion Criterion - Specify conditions that will exclude patients from the cohort'},
  {name: 'baseline', info: 'Baseline Characteristic - Define characteristics to be measured at the time of cohort entry'},
  {name: 'outcome', info: 'Outcome - Define events or measurements to be tracked after cohort entry'}
];

export const TypeSelectorEditor: React.FC<TypeSelectorEditorProps> = (props) => {
  const [selectedType, setSelectedType] = React.useState<string | null>(props.value || null);

  const handleTypeSelect = (typeName: string) => {
    setSelectedType(typeName);
    props.onValueChange?.(typeName);
  };

  return (
    <div className={styles.container}>
      {types.map((type) => (
        <div
          key={type.name}
          className={`${styles.typeSection} ${selectedType === type.name ? styles.selected : ''}`}
          onClick={() => handleTypeSelect(type.name)}
        >
          <div className={styles.typeName}>{type.name}</div>
          <p className={styles.typeInfo}>{type.info}</p>
        </div>
      ))}
    </div>
  );
};