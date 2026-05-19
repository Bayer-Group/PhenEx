import { FC, useState, useRef, useCallback, useEffect } from 'react';
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
      finalCohortSizes?: Record<string, number | null>;
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

interface RenderRowOptions {
  label?: string;
  labelClassName?: string;
  labelStyle?: React.CSSProperties;
}

interface RenderGroup {
  name: string;
  displayName: string;
  color: string;
  mainRow: RenderRow | null;
  rows: RenderRow[];
}

function formatCohortLabel(value: string): string {
  const spaced = value.replace(/_/g, ' ').trim();
  if (!spaced) return value;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
  const { cohortData, ticks = DEFAULT_TICKS, finalCohortSizes = {} } = data._meta;
  const { name } = data;
  const { activeIndex, onHover } = useBarHoverStore();
  const [hover, setHover] = useState<{ index: number; x: number; top: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const barRefs = useRef<Record<number, HTMLDivElement>>({});

  const openModal = useCallback(() => { if (!isModal) setModalOpen(true); }, [isModal]);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const isPresentation = mode === 'presentation';

  // Clear selection on any user scroll (delayed to skip programmatic scroll-into-view)
  useEffect(() => {
    if (!isPresentation || activeIndex === null) return;
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      const onScroll = () => onHover(null);
      window.addEventListener('scroll', onScroll, true);
      cleanup = () => window.removeEventListener('scroll', onScroll, true);
    }, 500);
    return () => { clearTimeout(timer); cleanup?.(); };
  }, [isPresentation, activeIndex, onHover]);

  // Always include the 100 line
  const allTicks = ticks.includes(100) ? ticks : [...ticks, 100];

  const groupedRows: RenderGroup[] = cohortData.reduce<RenderGroup[]>((groups, cohort, index) => {
    const { parent, label } = splitCohortName(cohort.name);
    let group = groups.find((entry) => entry.name === parent);
    if (!group) {
      group = {
        name: parent,
        displayName: formatCohortLabel(parent),
        color: cohort.color,
        mainRow: null,
        rows: [],
      };
      groups.push(group);
    }
    const entry = { cohort, originalIndex: index, label: formatCohortLabel(label) };
    if (label === 'main') {
      group.mainRow = entry;
    } else {
      group.rows.push(entry);
    }
    return groups;
  }, []);

  const flatRows: RenderRow[] = cohortData.map((cohort, index) => {
    const { label } = splitCohortName(cohort.name);
    return {
      cohort,
      originalIndex: index,
      label: formatCohortLabel(label),
    };
  });


  const renderRow = (entry: RenderRow, options?: RenderRowOptions) => {
    const row = entry.cohort.data.rows.find((r) => r.Name === name);
    const pct = row?.Pct ?? 0;
    const n = row?.N ?? 0;
    const finalCohortSize = finalCohortSizes[entry.cohort.name];
    const dimmed = activeIndex !== null && activeIndex !== entry.originalIndex;
    const label = options?.label ?? entry.label;
    const labelClassName = options?.labelClassName ?? '';

    return (
      <div
        key={entry.cohort.name}
        ref={(el) => { if (el) barRefs.current[entry.originalIndex] = el; }}
        className={`${styles.cohortRow} ${isPresentation ? styles.cohortRowPresentation : ''}`}
        onClick={isPresentation ? (e) => { e.stopPropagation(); onHover(activeIndex === entry.originalIndex ? null : entry.originalIndex); } : openModal}
        onMouseEnter={!isPresentation ? (e) => {
          const rect = barRefs.current[entry.originalIndex]?.getBoundingClientRect();
          if (rect) setHover({ index: entry.originalIndex, x: e.clientX, top: rect.top });
        } : undefined}
        onMouseMove={!isPresentation ? (e) => {
          const rect = barRefs.current[entry.originalIndex]?.getBoundingClientRect();
          if (rect) setHover({ index: entry.originalIndex, x: e.clientX, top: rect.top });
        } : undefined}
        onMouseLeave={!isPresentation ? () => setHover(null) : undefined}
        style={{ cursor: 'pointer' }}
      >
        {isPresentation && (
          <div
            className={`${styles.cohortLabelCell} ${labelClassName}`.trim()}
            style={options?.labelStyle}
          >
            {label}
          </div>
        )}
        <div
          className={styles.dataCells}
        >
          <div
            className={styles.pctCell}
            style={{ opacity: dimmed ? 0.25 : 1 }}
          >
            <strong>{pct.toFixed(pctDecimals)}</strong>
          </div>
          <div
            className={styles.barCell}
            style={{ opacity: dimmed ? 0.25 : 1 }}
          >
            <div
              className={styles.barFill}
              style={{ width: `${Math.max(0, pct)}%`, backgroundColor: entry.cohort.color }}
            />
          </div>
          <div className={styles.nCell} style={{ opacity: dimmed ? 0.25 : 1, color: activeIndex === entry.originalIndex ? '#000' : undefined }}>
            {isPresentation && finalCohortSize != null ? (
              <>
                <span className={styles.nValuePrimary}>{n.toLocaleString()}</span>
                <span className={styles.nValueSlash}>/</span>
                <span className={styles.nValueSecondary}>{finalCohortSize.toLocaleString()}</span>
              </>
            ) : (
              n.toLocaleString()
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPresentationGroup = (group: RenderGroup) => {
    const mainRow = group.mainRow;
    const hasSubrows = group.rows.length > 0;

    return (
      <div key={group.name} className={styles.groupSection}>
        <div className={styles.groupRows}>
          <div className={`${styles.gridOverlay} ${styles.gridOverlayPresentation}`}>
            {allTicks.map((t) => (
              <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
            ))}
          </div>

          {mainRow ? (
            renderRow(mainRow, {
              label: group.displayName,
              labelClassName: styles.parentCohortLabelCell,
              labelStyle: { backgroundColor: group.color },
            })
          ) : (
            <div className={styles.groupTitleStandalone} style={{ backgroundColor: group.color }}>
              {group.displayName}
            </div>
          )}

          {hasSubrows && group.rows.map((entry) => renderRow(entry))}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${isPresentation ? styles.containerPresentation : ''}`}>
      {/* Dismiss overlay — any click exits cohort-select state */}
      {isPresentation && activeIndex !== null && (
        <div className={styles.dismissOverlay} onClick={(e) => { e.stopPropagation(); onHover(null); }} />
      )}

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
          groupedRows.map(renderPresentationGroup)
        ) : (
          <>
            <div className={styles.gridOverlay} style={{ left: '0%', width: '100%' }}>
              {allTicks.map((t) => (
                <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
              ))}
            </div>
            {flatRows.map((entry) => renderRow(entry))}
          </>
        )}
      </div>

      {hover && !isPresentation && (
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
