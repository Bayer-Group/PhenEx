import React from 'react';
import { ItemList } from '../../../components/ItemList/ItemList';

export interface ConstantTypeSelectorEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

const constantTypes = [
  {
    name: 'DateFilter',
    info: 'For absolute date ranges (e.g., 2016-01-01 to 2023-12-31)',
  },
  {
    name: 'RelativeTimeRangeFilter',
    info: 'For relative time periods (e.g., before/after index date)',
  },
  {
    name: 'CategoricalFilter',
    info: 'For categorical values (e.g., inpatient, outpatient)',
  },
  {
    name: 'array',
    info: 'For arrays of values (e.g., list of domains)',
  },
];

export const ConstantTypeSelectorEditor: React.FC<ConstantTypeSelectorEditorProps> = props => {
  const [selectedType, setSelectedType] = React.useState<string | null>(
    props.value || null
  );

  const handleTypeSelect = (typeName: string) => {
    setSelectedType(typeName);
    props.onValueChange?.(typeName);
  };

  return (
    <div style={{ padding: '8px', minWidth: '250px' }}>
      <ItemList
        items={constantTypes}
        selectedName={selectedType || undefined}
        onSelect={handleTypeSelect}
        showFilter={false}
      />
    </div>
  );
};
