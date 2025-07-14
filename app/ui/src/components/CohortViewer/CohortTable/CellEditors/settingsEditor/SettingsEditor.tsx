import React from 'react';
import styles from './SettingsEditor.module.css';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';

export interface SettingsEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

const settings = [
  {
    name: 'Delete',
    info: 'Permanenty delete',
  },
];

export const SettingsEditor: React.FC<SettingsEditorProps> = props => {
  const [selectedPhenotype, setSelectedPhenotype] = React.useState<string | null>(
    props.value || null
  );
  
  const dataService = CohortDataService.getInstance();

  const deletePhenotype = () => {
      if (props.data?.id) {
        dataService.deletePhenotype(props.data.id);
      }
  };

  const createDeleteButton = () => {
    return (
      <div
          className={`${styles.settingSection}`}
          onClick={() => deletePhenotype()}
        >
          <div className={styles.settingName}>Delete</div>
          <p className={styles.settingInfo}>Permanently delete the {props.data.type} phenotype <span className={styles.emph}>"{props.data.name}"</span>. This will remove it from the cohort and cannot be undone.</p>
      </div>
    )
  }

  const createDuplicateButton = () => {
    return (
      <div
          className={`${styles.settingSection}`}
          // onClick={() => deletePhenotype()}
        >
          <div className={styles.settingName}>Duplicate</div>
          <p className={styles.settingInfo}>Duplicate <span className={styles.emph}>"{props.data.name}"</span> within the cohort.</p>
      </div>
    )
  }

  const createCopyButton = () => {
    return (
      <div
          className={`${styles.settingSection}`}
          // onClick={() => deletePhenotype()}
        >
          <div className={styles.settingName}>Copy</div>
          <p className={styles.settingInfo}>Copy <span className={styles.emph}>"{props.data.name}"</span> to the clipboard. You can then paste into other cohorts.</p>
      </div>
    )
  }


  const createExecuteButton = () => {
    return (
      <div
          className={`${styles.settingSection}`}
          // onClick={() => deletePhenotype()}
        >
          <div className={styles.settingName}>Execute</div>
          <p className={styles.settingInfo}>Execute <span className={styles.emph}>"{props.data.name}"</span> only. This will execute the phenotype and update the cohort.</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
        {createDuplicateButton()}
        {createCopyButton()}
        {createExecuteButton()}
        {createDeleteButton()}
    </div>
  );
};
