import React from 'react';
import styles from './TypeSelectorEditor.module.css';
import { ItemList } from '../../../../../components/ItemList/ItemList'; // adjust path as needed

export interface TypeSelectorEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

const types = [
  { name: 'entry', info: 'Define the entry criterion of your study; this defines the index date. A cohort can have only one entry criterion.' },
  {
    name: 'inclusion',
    info: 'Specify conditions that must be met for patients to be included in the cohort',
  },
  {
    name: 'exclusion',
    info: 'Specify conditions that will exclude patients from the cohort',
  },
  {
    name: 'baseline',
    info: 'Define phenotypes to be displayed in Table 1. Generally, these should assess patients during the baseline period.',
  },
  {
    name: 'outcome',
    info: 'Define phenotypes for which a time to event analysis is desired',
  },
];

export const TypeSelectorEditor: React.FC<TypeSelectorEditorProps> = props => {
  const [selectedType, setSelectedType] = React.useState<string | null>(props.value || null);

  const handleTypeSelect = (typeName: string) => {
    setSelectedType(typeName);
    console.log('SETTING TYPE', typeName);
    props.onValueChange?.(typeName);
  };

  return (
    <div className={styles.container}>
      <ItemList
        items={types}
        selectedName={selectedType || undefined}
        onSelect={handleTypeSelect}
      />
    </div>
  );
};
