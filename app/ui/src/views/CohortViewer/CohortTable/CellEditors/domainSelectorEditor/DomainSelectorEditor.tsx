import React, { useState, useEffect } from 'react';
import styles from './DomainSelectorEditor.module.css';
import { MapperDomains, DomainInfo } from '../../../../../types/mappers';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';
import { ItemList } from '../../../../../components/ItemList/ItemList'; // adjust path as needed
import typeStyles from '../../../../../styles/study_types.module.css';

export interface DomainSelectorEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

export const DomainSelectorEditor: React.FC<DomainSelectorEditorProps> = props => {
  const [cohortDataService] = useState(() => CohortDataService.getInstance());
  const [selectedDomain, setSelectedDomain] = useState<string | null>(props.value || null);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [mapper, setMapper] = useState<string>('');

  useEffect(() => {
    const _mappers = cohortDataService.cohort_data.database_config?.mapper;
    setMapper(_mappers);

    if (_mappers) {
      setDomains(MapperDomains[_mappers]);
    }

    console.log('SETTING DOMAINS TO TO : ', domains, mapper);
  }, [cohortDataService.cohort_data.database_config?.mapper]);

  const handleDomainSelect = (domainName: string) => {
    setSelectedDomain(domainName);
    props.onValueChange?.(domainName);
  };

  console.log(props);
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.headerText}>
          Using {mapper} mappers. Configure in Database<br></br> Current selection :{' '}
          {selectedDomain}{' '}
        </p>
      </div>
      <div className={styles.content}>
        <ItemList
          items={domains}
          selectedName={selectedDomain || undefined}
          onSelect={handleDomainSelect}
          classNameListItem={typeStyles[`${props.data.effective_type}_list_item`]}
          classNameListItemSelected={`${typeStyles[`${props.data.effective_type}_list_item_selected`]}`}
        />
      </div>
    </div>
  );
};
