import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { CohortSelector } from './ReportFloatingControls/CohortSelector';
import { ReportSelector } from './ReportFloatingControls/ReportSelector';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { Portal } from '../../components/Portal/Portal';
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
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'cohorts' | 'reports'>('cohorts');
  const [regionRect, setRegionRect] = useState<DOMRect | null>(null);
  const { isLeftPanelShown } = useThreePanelCollapse();

  const updateRect = useCallback(() => {
    const el = scrollRegionRef.current;
    if (el) setRegionRect(el.getBoundingClientRect());
  }, []);

  useEffect(() => {
    const el = scrollRegionRef.current;
    if (!el) return;
    updateRect();
    const ro = new ResizeObserver(updateRect);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateRect]);

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
      <div ref={scrollRegionRef} className={styles.scrollRegion}>
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
      </div>
      {regionRect && isLeftPanelShown && (
        <Portal>
          <div style={{
            position: 'fixed',
            top: regionRect.top,
            left: regionRect.left,
            width: regionRect.width,
            height: regionRect.height,
            pointerEvents: 'none',
            zIndex: 10001,
          }}>
            <div style={{ pointerEvents: 'auto' }}>
              <SimpleCustomScrollbar
                targetRef={scrollRef}
                orientation="vertical"
                marginTop={60}
                marginBottom={20}
                marginToEnd={7}
              />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
