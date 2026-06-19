import { FC, useRef, useState } from 'react';
import { CohortSelector } from './ReportFloatingControls/CohortSelector';
import { CohortActionBar } from './ReportFloatingControls/CohortActionBar';
import { ReportSelector } from './ReportFloatingControls/ReportSelector';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { type OutlineEntry } from './OutlineBar';
import { type SequentialRow } from './studyRegistryUtils';
import type { CohortGroup, LegendSelection, CohortDescriptions, Report } from './types';
import { useThreePanelCollapse } from '../../contexts/ThreePanelCollapseContext';
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
  finalCohortSizes?: Record<string, number | null>;
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
  finalCohortSizes,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'cohorts' | 'reports'>('cohorts');
  const [showAll, setShowAll] = useState(false);
  const { isLeftPanelShown } = useThreePanelCollapse();

  return (
    <div className={styles.container}>
      <div ref={scrollRegionRef} className={styles.scrollRegion}>
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
        {activeTab === 'cohorts' && (
          <div className={styles.actionBarRegion}>
            <CohortActionBar
              groups={groups}
              selections={selections}
              showAll={showAll}
              onToggleShowAll={() => setShowAll((v) => !v)}
              onAdd={onAdd}
              onRemove={onRemove}
            />
          </div>
        )}
        <div ref={scrollRef} className={styles.scrollContent}>
          {activeTab === 'cohorts' ? (
            <CohortSelector
              groups={groups}
              selections={selections}
              showAll={showAll}
              onReplace={onReplace}
              onAdd={onAdd}
              onRemove={onRemove}
              cohortDescriptions={cohortDescriptions}
              finalCohortSizes={finalCohortSizes}
            />
          ) : (
            <ReportSelector
              reports={reports ?? []}
              onSelect={onSelectReport ?? (() => {})}
            />
          )}
        </div>
        {isLeftPanelShown && (
          <div className={styles.scrollbarRegion}>
            <SimpleCustomScrollbar
              targetRef={scrollRef}
              orientation="vertical"
              // height={140}
              // marginBottom={'30vh'}
              marginTop={100}
              marginBottom={0}
              marginToEnd={0}
              classNameTrack={styles.scrollBarTrack}
              classNameThumb={styles.scrollBarThumb}
              showOnHover={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};
