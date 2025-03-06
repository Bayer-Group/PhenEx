import { FC, useState } from 'react';
import styles from './CohortViewerHeader.module.css';
import { CohortDataService } from './CohortDataService';
import { Tabs } from '../Tabs/Tabs';
import { CohortViewType } from './CohortViewer';
import { ButtonsBarWithDropdowns } from '../ButtonsBar/ButtonsBarWithDropdowns';
import { phenotypeTypeValues } from '../../types/phenotype'

interface CohortViewerHeaderProps {
  cohortName: string;
  dataService: CohortDataService;
  onCohortNameChange: (newValue: string) => void;
  onSaveChanges: () => void;
  navigateTo?: (viewType: CohortViewType) => void;
  onAddPhenotype?: (type: string) => void;

}

export const CohortViewerHeader: FC<CohortViewerHeaderProps> = ({
  cohortName,
  dataService,
  onCohortNameChange,
  onSaveChanges,
  navigateTo,
  onAddPhenotype,
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

  

  const handleExecute = () => {
    onSaveChanges();
  };

  const handleNewPhenotype = () => {
    // TODO: Implement new phenotype creation
  };

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
            onCohortNameChange(newValue);
            dataService.cohort_name = newValue;
          }}
          onKeyDown={async e => {
            if (e.key === 'Enter') {
              onSaveChanges();
            }
          }}
        />

      </div>
      <div className={styles.controlsContainer}>
        <Tabs
          width={400}
          height={30}
          tabs={tabs}
          onTabChange={onTabChange}
          active_tab_index = {1}
        />
        <ButtonsBarWithDropdowns
          width={200}
          height={30}
          buttons={['Execute', 'New Phenotype']}
          actions={[handleExecute, handleNewPhenotype]}
          dropdown_items={[null, phenotypeTypeValues]}
          onDropdownSelection={(buttonIndex, selectedItem) => {
            if (buttonIndex === 1 && onAddPhenotype) {
              onAddPhenotype(selectedItem);
            }
          }}
        />
      </div>
    </div>
  );
};