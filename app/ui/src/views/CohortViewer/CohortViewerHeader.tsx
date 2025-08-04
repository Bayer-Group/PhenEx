import { FC, useState, useEffect } from 'react';
import styles from './CohortViewerHeader.module.css';
import { CohortDataService } from './CohortDataService/CohortDataService';
import { Tabs } from '../Tabs/Tabs';
import { CohortViewType } from './CohortViewer';
import { IssuesDisplayControl } from './CohortIssuesDisplay/IssuesDisplayControl';
import { EditableTextField } from '../../components/EditableTextField/EditableTextField';

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
        setCohortName(dataService._cohort_name);
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
        <EditableTextField
          value={cohortName}
          placeholder="Name your cohort..."
          className={styles.cohortNameInput}
          onChange={newValue => {
            setCohortName(newValue);
            onCohortNameChange(newValue);
            dataService.cohort_name = newValue;
          }}
          onSaveChanges={onSaveChanges}
        />
      </div>
      {/* <div className={styles.controlsContainer}>
        <Tabs width={400} height={25} tabs={tabs} onTabChange={onTabChange} active_tab_index={1} />
      </div> */}
      <IssuesDisplayControl />
    </div>
  );
};
