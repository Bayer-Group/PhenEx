import { FC, useRef } from 'react';
import { CohortSelector } from './ReportFloatingControls/CohortSelector';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { LeftPanelTitleNavigation } from './LeftPanelTitleNavigation';
import { type OutlineEntry } from './OutlineBar';
import { type SequentialRow } from './studyRegistryUtils';
import type { CohortGroup, LegendSelection, CohortDescriptions } from './types';
import styles from './LeftPanel.module.css';

interface LeftPanelProps {
  title: string;
  groups: CohortGroup[];
  selections: LegendSelection[];
  entries: OutlineEntry[];
  rows: SequentialRow[];
  activeSection?: string | null;
  activeRowIndex?: number | null;
  onOpenRow?: (index: number) => void;
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
  cohortDescriptions?: CohortDescriptions;
}

export const LeftPanel: FC<LeftPanelProps> = ({
  title,
  groups,
  selections,
  entries,
  rows,
  activeSection,
  activeRowIndex,
  onOpenRow,
  onReplace,
  onAdd,
  onRemove,
  cohortDescriptions,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.container}>
      <div className={styles.tabRegion}></div>
      <div className={styles.scrollRegion}>
        <div ref={scrollRef} className={styles.scrollContent}>
          <CohortSelector
            groups={groups}
            selections={selections}
            onReplace={onReplace}
            onAdd={onAdd}
            onRemove={onRemove}
            cohortDescriptions={cohortDescriptions}
          />
        </div>
        <SimpleCustomScrollbar
          targetRef={scrollRef}
          orientation="vertical"
          marginTop={60}
          marginBottom={100}
          marginToEnd={5}
        />
      </div>
    </div>
  );
};
