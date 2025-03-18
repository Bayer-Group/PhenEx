import { FC, useState, useEffect } from 'react';
import styles from './CohortViewerHeader.module.css';
import { CohortDataService } from './CohortDataService';
import { Tabs } from '../Tabs/Tabs';
import { CohortViewType } from './CohortViewer';
import { CohortIssuesDisplay } from './CohortIssuesDisplay/CohortIssuesDisplay';

interface CohortViewerHeaderProps {
  onCohortNameChange: (newValue: string) => void;
  onSaveChanges: () => void;
  navigateTo?: (viewType: CohortViewType) => void;
}

export const CohortViewerHeader: FC<CohortViewerHeaderProps> = ({
  onCohortNameChange,
  onSaveChanges,
  navigateTo,
}) => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [cohortName, setCohortName] = useState('');

  useEffect(() => {
    const updateCohortName = () => {
      if (dataService.cohort_data?.name) {
        setCohortName(dataService.cohort_data.name);
      }
    };

    updateCohortName();
    dataService.addListener(updateCohortName);

    return () => {
      dataService.removeListener(updateCohortName);
    };
  }, [dataService]);

  const tabs = Object.values(CohortViewType).map(value => {
    return value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  const onTabChange = (index: number) => {
    const viewTypes = Object.values(CohortViewType);
    navigateTo(viewTypes[index]);
  };

  useEffect(() => {}, [dataService]);

  return (
    <div className={styles.topSection}>
      <div className={styles.headerContent}>
        <input
          type="text"
          className={styles.cohortNameInput}
          placeholder="Name your cohort..."
          value={cohortName}
          onChange={e => {
            const newValue = e.target.value;
            setCohortName(newValue);
            onCohortNameChange(newValue);
            dataService.cohort_name = newValue;
            dataService.cohort_data.name = newValue;
          }}
          onKeyDown={async e => {
            if (e.key === 'Enter') {
              onSaveChanges();
            }
          }}
        />
      </div>
      <div className={styles.controlsContainer}>
        <Tabs width={400} height={30} tabs={tabs} onTabChange={onTabChange} active_tab_index={1} />
      </div>
      <CohortIssuesDisplay />

    </div>
  );
};
