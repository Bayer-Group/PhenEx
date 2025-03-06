import { FC, useState } from 'react';
import styles from './CohortViewerHeader.module.css';
import { CohortDataService } from './CohortDataService';
import { Tabs } from '../Tabs/Tabs';
import { CohortViewType } from './CohortViewer';

interface CohortViewerHeaderProps {
  cohortName: string;
  dataService: CohortDataService;
  onCohortNameChange: (newValue: string) => void;
  onSaveChanges: () => void;
  navigateTo?: (viewType: CohortViewType) => void;
}

export const CohortViewerHeader: FC<CohortViewerHeaderProps> = ({
  cohortName,
  dataService,
  onCohortNameChange,
  onSaveChanges,
  navigateTo,
}) => {
  const tabs = Object.values(CohortViewType).map(value => {
    return value.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  const onTabChange = (index: number) => {
    const viewTypes = Object.values(CohortViewType);
    navigateTo(viewTypes[index]);
  };

  

  return (
    <div className={styles.topSection}>
      <input
        type="text"
        className={styles.cohortNameInput}
        placeholder="Name your cohort..."
        value={cohortName}
        onChange={e => {
          const newValue = e.target.value;
          onCohortNameChange(newValue);
          dataService.cohort_name = newValue;
        }}
        onKeyDown={async e => {
          if (e.key === 'Enter') {
            onSaveChanges();
          }
        }}
      />
      <Tabs
        width={400}
        height={30}
        tabs={tabs}
        onTabChange={onTabChange}
        active_tab_index = {1}
      />
    </div>
  );
};