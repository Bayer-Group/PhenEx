import React from 'react';
import styles from './SettingsEditor.module.css';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';
import { ItemList } from '../../../../../components/ItemList/ItemList'; // adjust path as needed

export interface SettingsEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
  data?: {
    id?: string;
    type?: string;
    name?: string;
  };
}

export const SettingsEditor: React.FC<SettingsEditorProps> = props => {
  const [selectedSetting, setSelectedSetting] = React.useState<string | null>(null);
  const dataService = CohortDataService.getInstance();

  const settings = [
    {
      name: 'Duplicate',
      info: `Duplicate "${props.data?.name || 'this phenotype'}" within the cohort.`,
    },
    {
      name: 'Copy',
      info: `Copy "${props.data?.name || 'this phenotype'}" to the clipboard. You can then paste into other cohorts.`,
    },
    {
      name: 'Execute',
      info: `Execute "${props.data?.name || 'this phenotype'}" only. This will execute the phenotype and update the cohort.`,
    },
    {
      name: 'Delete',
      info: `Permanently delete the ${props.data?.type || ''} phenotype "${props.data?.name || 'this phenotype'}". This will remove it from the cohort and cannot be undone.`,
    },
  ];

  const handleSettingSelect = (settingName: string) => {
    setSelectedSetting(settingName);

    switch (settingName) {
      case 'Delete':
        deletePhenotype();
        break;
      case 'Duplicate':
        duplicatePhenotype();
        break;
      case 'Copy':
        copyPhenotype();
        break;
      case 'Execute':
        executePhenotype();
        break;
      default:
        break;
    }

    // Reset selection after action
    setTimeout(() => setSelectedSetting(null), 200);
  };

  const deletePhenotype = () => {
    if (props.data?.id) {
      dataService.deletePhenotype(props.data.id);
    }
  };

  const duplicatePhenotype = () => {
    // TODO: Implement duplicate functionality
    console.log('Duplicate phenotype:', props.data?.name);
  };

  const copyPhenotype = () => {
    // TODO: Implement copy functionality
    console.log('Copy phenotype:', props.data?.name);
  };

  const executePhenotype = () => {
    // TODO: Implement execute functionality
    console.log('Execute phenotype:', props.data?.name);
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
