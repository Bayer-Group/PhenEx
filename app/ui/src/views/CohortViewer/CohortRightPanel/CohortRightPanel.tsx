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
      <InfoPanel />
      <DatabasePanel />
      <CodelistsViewer />
      <ConstantsPanel />
      <VisibilityPanel />
      <ExecutePanel />
    </div>
  );
};
