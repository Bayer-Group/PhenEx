import { FC, useRef, useState } from 'react';
import { CohortSelector } from './ReportFloatingControls/CohortSelector';
import { ReportSelector } from './ReportFloatingControls/ReportSelector';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { type OutlineEntry } from './OutlineBar';
import { type SequentialRow } from './studyRegistryUtils';
import type { CohortGroup, LegendSelection, CohortDescriptions, Report } from './types';
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
  reports?: Report[];
  onSelectReport?: (report: Report) => void;
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
  reports,
  onSelectReport,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'cohorts' | 'reports'>('cohorts');

  return (
    <div className={styles.container}>
      <div className={styles.tabRegion}>
        <Tabs
          tabs={['Cohorts', 'Reports']}
          active_tab_index={activeTab === 'cohorts' ? 0 : 1}
          onTabChange={(i) => setActiveTab(i === 0 ? 'cohorts' : 'reports')}
          classNameTabsContainer={styles.tabsContainer}
          classNameTabs={styles.tab}
          classNameActiveTab={styles.tabActive}
          classNameHoverTab={styles.tabHover}
        />
      </div>
      <div className={styles.scrollRegion}>
        <div ref={scrollRef} className={styles.scrollContent}>
          {activeTab === 'cohorts' ? (
            <CohortSelector
              groups={groups}
              selections={selections}
              onReplace={onReplace}
              onAdd={onAdd}
              onRemove={onRemove}
              cohortDescriptions={cohortDescriptions}
            />
          ) : (
            <ReportSelector
              reports={reports ?? []}
              onSelect={onSelectReport ?? (() => {})}
            />
          )}
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
