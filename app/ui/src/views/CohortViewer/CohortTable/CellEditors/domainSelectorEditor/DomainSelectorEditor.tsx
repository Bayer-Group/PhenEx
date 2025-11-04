import React, { useState } from 'react';
import styles from './DomainSelectorEditor.module.css';
import { useDomains } from '../../../../../hooks/useDomains';
import { ItemList } from '../../../../../components/ItemList/ItemList';
import typeStyles from '../../../../../styles/study_types.module.css';

export interface DomainSelectorEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
  data?: {
    effective_type?: string;
  };
}

/**
 * Component for selecting a domain from available mapper domains.
 * Uses the useDomains hook to load domains based on the current database mapper configuration.
 */
export const DomainSelectorEditor: React.FC<DomainSelectorEditorProps> = props => {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(props.value || null);
  const { domains, mapper } = useDomains();

  /**
   * Handles domain selection and propagates the change to the parent component
   */
  const handleDomainSelect = (domainName: string) => {
    setSelectedDomain(domainName);
    props.onValueChange?.(domainName);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.headerText}>
          Using {mapper} mappers. Configure in Database<br />
          Current selection: {selectedDomain}
        </p>
      </div>
      <div className={styles.content}>
        <ItemList
          items={domains}
          selectedName={selectedDomain || undefined}
          onSelect={handleDomainSelect}
          classNameListItem={props.data?.effective_type ? typeStyles[`${props.data.effective_type}_list_item`] : undefined}
          classNameListItemSelected={props.data?.effective_type ? typeStyles[`${props.data.effective_type}_list_item_selected`] : undefined}
        />
      </div>
    </div>
  );
};
