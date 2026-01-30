import React, { useRef } from 'react';
import { InfoPanel } from '../../SlideoverPanels/InfoPanel/InfoPanel';
import { DatabasePanel } from '../../SlideoverPanels/DatabasePanel/DatabasePanel';
import { CodelistsViewer } from '../../SlideoverPanels/CodelistsViewer/CodelistsViewer';
import { ConstantsPanel } from '../../SlideoverPanels/ConstantsPanel/ConstantsPanel';
import { VisibilityPanel } from '../../SlideoverPanels/VisibilityPanel/VisibilityPanel';
import { CohortReportView } from '../../SlideoverPanels/CohortReportView/CohortReportView';
import { ExecutePanel } from '../../SlideoverPanels/ExecutePanel/ExecutePanel';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar';
import styles from './CohortRightPanel.module.css';

interface CohortRightPanelProps {
  contentMode?: 'cohort' | 'study';
}

export const CohortRightPanel: React.FC<CohortRightPanelProps> = ({ contentMode = 'cohort' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.container}>
        <InfoPanel />
        <DatabasePanel />
        <CodelistsViewer />
        <ConstantsPanel />
        <VisibilityPanel />
        <ExecutePanel />
      </div>
      <SimpleCustomScrollbar targetRef={containerRef} 
        marginToEnd={10}
      />
    </div>
  );
};
