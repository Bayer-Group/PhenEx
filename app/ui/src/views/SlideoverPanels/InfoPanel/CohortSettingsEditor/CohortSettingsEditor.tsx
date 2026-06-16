import React from 'react';
import styles from './CohortSettingsEditor.module.css';
import { CohortDataService } from '../../../CohortViewer/CohortDataService/CohortDataService';
import { ItemList } from '../../../../components/ItemList/ItemList';
import { MainViewService } from '../../../MainView/MainView';

export interface CohortSettingsEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
  data?: {
    id?: string;
    type?: string;
    name?: string;
  };
}

export const CohortSettingsEditor: React.FC<CohortSettingsEditorProps> = props => {
  const [selectedSetting, setSelectedSetting] = React.useState<string | null>(null);
  const dataService = CohortDataService.getInstance();

  const settings = [
    {
      name: 'Export',
      info: 'Export the cohort data to a file for backup or sharing.',
    },
    {
      name: 'Import',
      info: 'Import cohort data from a file to replace or merge with current cohort.',
    },
    {
      name: 'Reset',
      info: 'Reset the cohort to its initial state. This will remove all phenotypes and data.',
    },
    {
      name: 'Delete',
      info: 'Permanently delete the entire cohort. This action cannot be undone.',
    },
  ];

  const handleSettingSelect = (settingName: string) => {
    setSelectedSetting(settingName);

    switch (settingName) {
      case 'Export':
        exportCohort();
        break;
      case 'Import':
        importCohort();
        break;
      case 'Reset':
        resetCohort();
        break;
      case 'Delete':
        deleteCohort();
        break;
      default:
        break;
    }

    // Reset selection after action
    setTimeout(() => setSelectedSetting(null), 200);
  };

  const exportCohort = () => {
    // TODO: Implement export functionality
    console.log('Export cohort');
  };

  const importCohort = () => {
    // TODO: Implement import functionality
    console.log('Import cohort');
  };

  const resetCohort = () => {
    // TODO: Implement reset functionality
    console.log('Reset cohort');
  };

  const deleteCohort = async () => {
    // Call the deleteCohort method from the data service
    await dataService.deleteCohort();
    console.log('Cohort deleted successfully');
    const mainViewService = MainViewService.getInstance();
    mainViewService.navigateTo('empty');
  };

  return (
    <div className={styles.container}>
      <ItemList
        items={settings}
        selectedName={selectedSetting || undefined}
        onSelect={handleSettingSelect}
      />
    </div>
  );
};
