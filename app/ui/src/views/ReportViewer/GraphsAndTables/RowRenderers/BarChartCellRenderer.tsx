import { FC, useState, useRef, useCallback } from 'react';
import { type CohortClassified } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import { CohortNameTooltip } from './CohortNameTooltip';
import { BooleanRowModal } from '../ModalRenderers/BooleanRowModal';
import styles from './BarChartCellRenderer.module.css';

const DEFAULT_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

interface BarChartCellRendererProps {
  data: {
    name: string;
    _meta: {
      cohortData: CohortClassified[];
      ticks?: number[];
    };
  };
  /** When true, suppress click-to-open-modal (used inside BooleanRowModal). */
  isModal?: boolean;
  breadcrumbs?: string[];
  /** Number of decimal places for the % column (default 0). */
  pctDecimals?: number;
  mode?: 'compact' | 'presentation';
}

interface RenderRow {
  cohort: CohortClassified;
  originalIndex: number;
  label: string;
}

interface RenderGroup {
  name: string;
  rows: RenderRow[];
}

function splitCohortName(name: string): { parent: string; label: string } {
  const idx = name.indexOf('__');
  if (idx === -1) return { parent: name, label: 'main' };
  return {
    parent: name.substring(0, idx),
    label: name.substring(idx + 2),
  };
}

export const BarChartCellRenderer: FC<BarChartCellRendererProps> = ({ data, isModal, breadcrumbs, pctDecimals = 0, mode = 'compact' }) => {
  const { cohortData, ticks = DEFAULT_TICKS } = data._meta;
  const { name } = data;
  const { activeIndex } = useBarHoverStore();
  const [hover, setHover] = useState<{ index: number; x: number; top: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const barRefs = useRef<Record<number, HTMLDivElement>>({});

  const openModal = useCallback(() => { if (!isModal) setModalOpen(true); }, [isModal]);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // Always include the 100 line
  const allTicks = ticks.includes(100) ? ticks : [...ticks, 100];

  const groupedRows: RenderGroup[] = cohortData.reduce<RenderGroup[]>((groups, cohort, index) => {
    const { parent, label } = splitCohortName(cohort.name);
    let group = groups.find((entry) => entry.name === parent);
    if (!group) {
      group = { name: parent, rows: [] };
      groups.push(group);
    }
    group.rows.push({ cohort, originalIndex: index, label });
    return groups;
  }, []);

  const isPresentation = mode === 'presentation';

  const renderRow = (entry: RenderRow) => {
    const row = entry.cohort.data.rows.find((r) => r.Name === name);
    const pct = row?.Pct ?? 0;
    const n = row?.N ?? 0;
    const dimmed = activeIndex !== null && activeIndex !== entry.originalIndex;

    return (
      <div
        key={entry.cohort.name}
        ref={(el) => { if (el) barRefs.current[entry.originalIndex] = el; }}
        className={`${styles.cohortRow} ${isPresentation ? styles.cohortRowPresentation : ''}`}
        onClick={openModal}
        onMouseEnter={(e) => {
          const rect = barRefs.current[entry.originalIndex]?.getBoundingClientRect();
          if (rect) setHover({ index: entry.originalIndex, x: e.clientX, top: rect.top });
        }}
        onMouseMove={(e) => {
          const rect = barRefs.current[entry.originalIndex]?.getBoundingClientRect();
          if (rect) setHover({ index: entry.originalIndex, x: e.clientX, top: rect.top });
        }}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'pointer' }}
      >
        {isPresentation && <div className={styles.cohortLabelCell}>{entry.label}</div>}
        <div className={styles.pctCell} style={{ opacity: dimmed ? 0.25 : 1 }}>
          <strong>{pct.toFixed(pctDecimals)}</strong>
        </div>
        <div className={styles.barCell} style={{ opacity: dimmed ? 0.25 : 1 }}>
          <div
            className={styles.barFill}
            style={{ width: `${Math.max(0, pct)}%`, backgroundColor: entry.cohort.color }}
          />
        </div>
        <div className={styles.nCell} style={{ opacity: dimmed ? 0.25 : 1, color: activeIndex === entry.originalIndex ? '#000' : undefined }}>
          {n.toLocaleString()}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${isPresentation ? styles.containerPresentation : ''}`}>
      {/* Header row */}
      <div className={`${styles.headerRow} ${isPresentation ? styles.headerRowPresentation : ''}`}>
        {isPresentation && <div className={styles.headerCohort}>Cohort</div>}
        <div className={styles.headerPct}>%</div>
        <div className={styles.headerBar}>
          {[0, 20, 40, 60, 80, 100].map((t) => (
            <span key={t} className={styles.headerTick} style={{ left: `${t}%` }}>{t}</span>
          ))}
        </div>
        <div className={styles.headerN}>N</div>
      </div>

      <div className={styles.rows}>
        {isPresentation ? (
          groupedRows.map((group) => (
            <div key={group.name} className={styles.groupSection}>
              <div className={styles.groupTitle}>{group.name}</div>
              <div className={styles.groupRows}>
                <div className={styles.gridOverlay} style={{ left: '0%', width: '100%' }}>
                  {allTicks.map((t) => (
                    <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
                  ))}
                </div>
                {group.rows.map(renderRow)}
              </div>
            </div>
          ))
        ) : (
          <>
            <div className={styles.gridOverlay} style={{ left: '0%', width: '100%' }}>
              {allTicks.map((t) => (
                <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
              ))}
            </div>
            {groupedRows.flatMap((group) => group.rows.map(renderRow))}
          </>
        )}
      </div>

      {hover && (
        <CohortNameTooltip
          name={cohortData[hover.index]?.name ?? ''}
          x={hover.x}
          top={hover.top}
        />
      )}

      {modalOpen && (
        <BooleanRowModal
          name={name}
          cohortData={cohortData}
          onClose={closeModal}
          breadcrumbs={breadcrumbs}
        />
      )}
    </div>
  );
};
