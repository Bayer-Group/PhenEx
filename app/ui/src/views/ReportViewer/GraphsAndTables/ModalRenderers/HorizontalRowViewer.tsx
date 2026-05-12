import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { type SequentialRow } from '../../studyRegistryUtils';
import { Portal } from '../../../../components/Portal/Portal';
import { SmartBreadcrumbs } from '../../../../components/SmartBreadcrumbs';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { BarChartCellRenderer } from '../RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from '../RowRenderers/CategoricalBarChartCellRenderer';
import { NumericChartFrame } from '../RowRenderers/NumericChartFrame';
import { KDEChartCellRenderer } from '../RowRenderers/KDEChartCellRenderer';
import { BoxPlotCellRenderer } from '../RowRenderers/BoxPlotCellRenderer';
import { NumericTableCellRenderer } from '../RowRenderers/NumericTableCellRenderer';
import numericStyles from './NumericGraphModal.module.css';
import booleanStyles from './BooleanRowModal.module.css';
import categoricalStyles from './CategoricalRowModal.module.css';
import styles from './HorizontalRowViewer.module.css';

// ── Constants ───────────────────────────────────────────────────────────

const ANIM_MS = 150;
const RENDER_NEIGHBOURS = 3; // only render chart content for cells within this range
const CELL_GAP = 16;

/** Track the last click Y so cards appear at the caller's position. */
let lastClickY = 0.1;
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    lastClickY = e.clientY / window.innerHeight;
  }, true);
}

// ── Props ───────────────────────────────────────────────────────────────

interface HorizontalRowViewerProps {
  rows: SequentialRow[];
  currentIndex: number;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

// ── Component ───────────────────────────────────────────────────────────

export const HorizontalRowViewer: FC<HorizontalRowViewerProps> = ({
  rows,
  currentIndex,
  cohortData,
  kdeData,
  onClose,
  onNavigate,
}) => {
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const mountY = useRef(lastClickY);

  const current = rows[currentIndex];
  const desiredTop = `${Math.min(Math.round(mountY.current * 60), 40)}vh`;

  // ── Scroll management ─────────────────────────────────────────────────

  const centerFocused = useCallback((instant: boolean) => {
    const scroller = scrollRef.current;
    const card = focusedRef.current;
    if (!scroller || !card) return;
    const target = Math.max(0, card.offsetLeft - (scroller.clientWidth - card.offsetWidth) / 2);
    if (instant) {
      scroller.scrollLeft = target;
    } else {
      scroller.scrollTo({ left: target, behavior: 'smooth' });
    }
  }, []);

  // Smooth scroll on navigate (rAF so the new ref is painted first)
  useEffect(() => {
    if (!didInitialScroll.current) return;
    requestAnimationFrame(() => centerFocused(false));
  }, [currentIndex, centerFocused]);

  // Instant scroll on mount
  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    centerFocused(true);
  }, [centerFocused]);

  // Block trackpad / wheel scrolling
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, []);

  // ── Close / keyboard ─────────────────────────────────────────────────

  const startClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, ANIM_MS);
  }, [closing, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) startClose();
    },
    [startClose],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') startClose();
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (currentIndex > 0) onNavigate(currentIndex - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (currentIndex < rows.length - 1) onNavigate(currentIndex + 1); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [startClose, currentIndex, rows.length, onNavigate]);

  if (!current) return null;

  return (
    <Portal>
      <div
        className={`${styles.overlay} ${closing ? styles.closing : ''}`}
        onClick={handleOverlayClick}
      >
        {/* Horizontal strip of cards — all cells in DOM, only nearby ones render content */}
        <div className={styles.scroller} ref={scrollRef} style={{ gap: CELL_GAP }}>
          {rows.map((row) => {
            const isFocused = row.index === currentIndex;
            const nearby = Math.abs(row.index - currentIndex) <= RENDER_NEIGHBOURS;
            const rowBc = [row.category, row.reporter, row.section, row.name]
              .filter(Boolean)
              .map((b) => ({ displayName: b as string, onClick: () => {} }));
            return (
              <div
                key={row.index}
                ref={isFocused ? focusedRef : null}
                className={styles.cell}
                style={{ '--desired-top': desiredTop } as React.CSSProperties}
                onClick={isFocused ? undefined : () => onNavigate(row.index)}
              >
                <div className={styles.verticalWrapper}>
                    <SmartBreadcrumbs
                    items={rowBc}
                    compact
                    classNameSmartBreadcrumbsContainer={styles.breadcrumbs}
                    classNameBreadcrumbItem={styles.crumb}
                    classNameBreadcrumbLastItem={styles.crumbLast}
                    />
                    <div className={`${styles.card} ${isFocused ? styles.cardFocused : styles.cardNeighbour}`}>
                    <div className={styles.cardTitle}>
                        {row.registry?.display_name || row.name}
                    </div>
                    <div className={styles.cardContent}>
                        {nearby
                        ? <RowContent row={row} cohortData={cohortData} kdeData={kdeData} />
                        : null}
                    </div>
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Portal>
  );
};

/* ── Content dispatcher ──────────────────────────────────────────────── */

const RowContent: FC<{
  row: SequentialRow;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}> = ({ row, cohortData, kdeData }) => {
  switch (row.rowType) {
    case 'boolean':
      return <BooleanContent name={row.name} cohortData={cohortData} />;
    case 'categorical':
      return <CategoricalContent baseName={row.name} cohortData={cohortData} />;
    case 'numeric':
      return <NumericContent name={row.name} cohortData={cohortData} kdeData={kdeData} />;
    default:
      return <div style={{ padding: 20, color: '#999' }}>No detail view for {row.rowType} rows yet.</div>;
  }
};

/* ── Boolean ─────────────────────────────────────────────────────────── */

const BooleanContent: FC<{ name: string; cohortData: CohortClassified[] }> = ({ name, cohortData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div className={booleanStyles.container}>
      <BarChartCellRenderer
        data={{ name, _meta: { cohortData: filtered } }}
        isModal
        pctDecimals={1}
      />
    </div>
  );
};

/* ── Categorical ─────────────────────────────────────────────────────── */

const CategoricalContent: FC<{ baseName: string; cohortData: CohortClassified[] }> = ({ baseName, cohortData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div className={categoricalStyles.container}>
      <CategoricalBarChartCellRenderer
        baseName={baseName}
        cohortData={filtered}
        orientation="vertical"
      />
    </div>
  );
};

/* ── Numeric ─────────────────────────────────────────────────────────── */

const NumericContent: FC<{
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}> = ({ name, cohortData, kdeData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  const { xMin, xMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const cd of cohortData) {
      const row = cd.data.rows.find((r) => r.Name === name);
      if (!row) continue;
      if (row.Min != null && row.Min < lo) lo = row.Min;
      if (row.Max != null && row.Max > hi) hi = row.Max;
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    return { xMin: lo, xMax: hi };
  }, [name, cohortData]);

  return (
    <div className={numericStyles.container}>
      <div className={numericStyles.distributionCard}>
        <NumericChartFrame xMin={xMin} xMax={xMax} showTicks>
          <div className={numericStyles.kdeSection}>
            <KDEChartCellRenderer
              name={name}
              cohortData={filtered}
              kdeData={kdeData}
              xMin={xMin}
              xMax={xMax}
              showTicks={false}
            />
          </div>
          <BoxPlotCellRenderer
            name={name}
            cohortData={filtered}
            xMin={xMin}
            xMax={xMax}
            showLabels
          />
        </NumericChartFrame>
      </div>
      <div className={numericStyles.bottomRow}>
        <div className={numericStyles.card}>
          <NumericTableCellRenderer name={name} cohortData={filtered} showBar />
        </div>
      </div>
    </div>
  );
};
