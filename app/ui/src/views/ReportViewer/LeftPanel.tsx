import { FC, useRef } from 'react';
import { CohortSelector } from './ReportFloatingControls/CohortSelector';
import { formatRunTimestamp } from './ReportViewer';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import type { CohortGroup, LegendSelection } from './types';
import styles from './LeftPanel.module.css';

interface LeftPanelProps {
  title: string;
  runId: string | null;
  loading: boolean;
  groups: CohortGroup[];
  selections: LegendSelection[];
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
}

export const LeftPanel: FC<LeftPanelProps> = ({
  title,
  runId,
  loading,
  groups,
  selections,
  onReplace,
  onAdd,
  onRemove,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.container}>
      <div ref={scrollRef} className={styles.leftPanel}>
        <div className={styles.navTitleCard}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle}>
            {runId ? `Executed ${formatRunTimestamp(runId)}` : loading ? 'Loading runs...' : ''}
          </span>
        </div>
        <CohortSelector
          groups={groups}
          selections={selections}
          onReplace={onReplace}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </div>
      <SimpleCustomScrollbar
        targetRef={scrollRef}
        orientation="vertical"
        marginTop={20}
        marginBottom={20}
        marginToEnd={5}
      />
    </div>
  );
};
