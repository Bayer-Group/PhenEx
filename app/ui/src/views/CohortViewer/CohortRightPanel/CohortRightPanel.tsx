import React, { useRef } from 'react';
import { InfoPanel } from '../../SlideoverPanels/InfoPanel/InfoPanel';
import { DatabasePanel } from '../../SlideoverPanels/DatabasePanel/DatabasePanel';
import { CodelistsViewer } from '../../SlideoverPanels/CodelistsViewer/CodelistsViewer';
import { RelativeTimeRangePanel } from '../../SlideoverPanels/ConstantsPanels/RelativeTimeRangePanel';
import { CategoricalFilterPanel } from '../../SlideoverPanels/ConstantsPanels/CategoricalFilterPanel';
import { TimeRangePanel } from '../../SlideoverPanels/ConstantsPanels/TimeRangePanel';
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
        <RelativeTimeRangePanel />
        <CategoricalFilterPanel />
        <TimeRangePanel />
        <CodelistsViewer />
        <ExecutePanel />
      </div>
      <SimpleCustomScrollbar targetRef={containerRef} 
        marginToEnd={2}
        marginBottom={120}
        marginTop={70}
        classNameThumb={styles.customScrollbarThumb}
        classNameTrack={styles.customScrollbarTrack}
      />
      <div className={styles.topGradient} />

    </div>
  );
};
