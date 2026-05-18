import { FC, useRef } from 'react';
import { CohortSelector } from './ReportFloatingControls/CohortSelector';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { LeftPanelTitleNavigation } from './LeftPanelTitleNavigation';
import { type OutlineEntry } from './OutlineBar';
import { type SequentialRow } from './studyRegistryUtils';
import type { CohortGroup, LegendSelection } from './types';
import styles from './LeftPanel.module.css';

interface LeftPanelProps {
  title: string;
  groups: CohortGroup[];
  selections: LegendSelection[];
  entries: OutlineEntry[];
  rows: SequentialRow[];
  activeSection?: string | null;
  onOpenRow?: (index: number) => void;
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
}

export const LeftPanel: FC<LeftPanelProps> = ({
  title,
  groups,
  selections,
  entries,
  rows,
  activeSection,
  onOpenRow,
  onReplace,
  onAdd,
  onRemove,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.container}>
      <LeftPanelTitleNavigation
        studyTitle={title}
        entries={entries}
        rows={rows}
        activeSection={activeSection}
        onOpenRow={onOpenRow}
      />
      <div className={styles.scrollRegion}>
        <div ref={scrollRef} className={styles.scrollContent}>
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
          marginTop={10}
          marginBottom={10}
          marginToEnd={5}
        />
      </div>
    </div>
  );
};
