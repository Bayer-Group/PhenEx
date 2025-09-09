import React from 'react';
import styles from './ReturnDateEditor.module.css';
import { ItemList } from '../../../../../components/ItemList/ItemList'; // adjust path as needed
import typeStyles from '../../../../../styles/study_types.module.css';

export interface ReturnDateEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
  data?: any;
}

const returnDateOptions = [
  {
    name: 'first',
    info: 'Return the first date in the defined time period',
  },
  {
    name: 'last',
    info: 'Return the last date in the defined time period',
  },
  {
    name: 'all',
    info: 'Return all dates. This returns multiple rows per patient',
  },
];

export const ReturnDateEditor: React.FC<ReturnDateEditorProps> = props => {
  const [selectedOption, setSelectedOption] = React.useState<string | null>(
    props.value || null
  );

  const handleOptionSelect = (optionName: string) => {
    setSelectedOption(optionName);
    props.onValueChange?.(optionName);
  };

  return (
    <div className={styles.container}>
      <ItemList
        items={returnDateOptions}
        selectedName={selectedOption || undefined}
        onSelect={handleOptionSelect}
        classNameListItem={typeStyles[`${props.data?.effective_type}_list_item`]}
        classNameListItemSelected={`${typeStyles[`${props.data?.effective_type}_list_item_selected`]}`}
      />
    </div>
  );
};
