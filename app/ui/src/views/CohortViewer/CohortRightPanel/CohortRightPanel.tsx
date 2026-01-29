import React from 'react';
import { InfoPanel } from '../../SlideoverPanels/InfoPanel/InfoPanel';
import { DatabasePanel } from '../../SlideoverPanels/DatabasePanel/DatabasePanel';
import { CodelistsViewer } from '../../SlideoverPanels/CodelistsViewer/CodelistsViewer';
import { ConstantsPanel } from '../../SlideoverPanels/ConstantsPanel/ConstantsPanel';
import { VisibilityPanel } from '../../SlideoverPanels/VisibilityPanel/VisibilityPanel';
import { CohortReportView } from '../../SlideoverPanels/CohortReportView/CohortReportView';
import { ExecutePanel } from '../../SlideoverPanels/ExecutePanel/ExecutePanel';
import styles from './CohortRightPanel.module.css';

interface CohortRightPanelProps {
  contentMode?: 'cohort' | 'study';
}

export const CohortRightPanel: React.FC<CohortRightPanelProps> = ({ contentMode = 'cohort' }) => {
  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Info</div>
        <div className={styles.sectionContent}>
          <InfoPanel />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Database</div>
        <div className={styles.sectionContent}>
          <DatabasePanel />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Codelists</div>
        <div className={styles.sectionContent}>
          <CodelistsViewer />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Constants</div>
        <div className={styles.sectionContent}>
          <ConstantsPanel />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Visibility</div>
        <div className={styles.sectionContent}>
          <VisibilityPanel />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Execute</div>
        <div className={styles.sectionContent}>
          <ExecutePanel />
        </div>
      </div>
    </div>
  );
};
