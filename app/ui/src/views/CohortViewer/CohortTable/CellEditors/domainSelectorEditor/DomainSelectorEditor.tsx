import React, { useState } from 'react';
import styles from './DomainSelectorEditor.module.css';
import { useDomains } from '../../../../../hooks/useDomains';
import { ItemList } from '../../../../../components/ItemList/ItemList';
import { DatabasePanel } from '../../../../SlideoverPanels/DatabasePanel/DatabasePanel';

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

  // When no mapper is configured, show the database panel instead of the domain
  // list. Once a database/mapper is selected, the useDomains hook updates and the
  // list is displayed automatically.
  if (!mapper) {
    return (
      <div className={styles.container}>
        <DatabasePanel showTitle={false} contentMode="cohort" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <ItemList
          items={domains}
          selectedName={selectedDomain || undefined}
          onSelect={handleDomainSelect}
        showFilter={true}
        />
      </div>
            <div className={styles.header}>
        
        using {mapper} mappers
      </div>

    </div>
  );
};
