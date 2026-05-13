import { FC, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { type SequentialRow, type RegistryComment } from '../../studyRegistryUtils';
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
import ReactMarkdown from 'react-markdown';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';

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
  onScrollToRow?: (el: HTMLElement | null) => void;
  registryComments?: RegistryComment[];
}

// ── Component ───────────────────────────────────────────────────────────

export const HorizontalRowViewer: FC<HorizontalRowViewerProps> = ({
  rows,
  currentIndex,
  cohortData,
  kdeData,
  onClose,
  onNavigate,
  onScrollToRow,
  registryComments,
}) => {
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const hasNavigated = useRef(false);
  const mountY = useRef(lastClickY);

  const current = rows[currentIndex];
  const desiredTop = `${Math.min(Math.round(mountY.current * 60), 40)}vh`;

  // Scroll the background report to the current row (only after first nav)
  useEffect(() => {
    if (!hasNavigated.current || !onScrollToRow || !current) return;
    const el = document.querySelector(`[data-row-name="${CSS.escape(current.name)}"]`) as HTMLElement | null;
    onScrollToRow(el);
  }, [currentIndex, current, onScrollToRow]);

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

  // Block trackpad / wheel scrolling (except inside comments scroll)
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(`.${styles.commentsScroll}`)) return;
      e.preventDefault();
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, []);

  // ── Close / keyboard ─────────────────────────────────────────────────

  const navigate = useCallback((index: number) => {
    hasNavigated.current = true;
    onNavigate(index);
  }, [onNavigate]);

  const startClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, ANIM_MS);
  }, [closing, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') startClose();
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (currentIndex > 0) navigate(currentIndex - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (currentIndex < rows.length - 1) navigate(currentIndex + 1); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [startClose, currentIndex, rows.length, navigate]);

  if (!current) return null;

  return (
    <Portal>
      <div
        className={`${styles.overlay} ${closing ? styles.closing : ''}`}
        onClick={startClose}
      >
        {/* Horizontal strip of cards — all cells in DOM, only nearby ones render content */}
        <div className={styles.scroller} ref={scrollRef} style={{ gap: CELL_GAP }}>
          {rows.map((row) => {
            const isFocused = row.index === currentIndex;
            const nearby = Math.abs(row.index - currentIndex) <= RENDER_NEIGHBOURS;
            return (
              <HorizontalCell
                key={row.index}
                ref={isFocused ? focusedRef : null}
                row={row}
                isFocused={isFocused}
                nearby={nearby}
                desiredTop={desiredTop}
                cohortData={cohortData}
                kdeData={kdeData}
                registryComments={registryComments}
                onNavigate={navigate}
              />
            );
          })}
        </div>
      </div>
    </Portal>
  );
};

/* ── HorizontalCell ──────────────────────────────────────────────────── */

interface HorizontalCellProps {
  row: SequentialRow;
  isFocused: boolean;
  nearby: boolean;
  desiredTop: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  registryComments?: RegistryComment[];
  onNavigate: (index: number) => void;
}

const HorizontalCell = forwardRef<HTMLDivElement, HorizontalCellProps>(
  ({ row, isFocused, nearby, desiredTop, cohortData, kdeData, registryComments, onNavigate }, ref) => {
    const rowBc = useMemo(
      () => [row.category, row.reporter, row.section, row.name]
        .filter(Boolean)
        .map((b) => ({ displayName: b as string, onClick: () => {} })),
      [row],
    );

    // Resolve comment IDs to actual comment objects
    const comments = useMemo(() => {
      if (!registryComments?.length || !row.registry?.comments?.length) return [];
      return row.registry.comments
        .map((id) => registryComments[id])
        .filter(Boolean);
    }, [registryComments, row.registry]);

    return (
      <div
        ref={ref}
        className={styles.cell}
        style={{ '--desired-top': desiredTop } as React.CSSProperties}
        onClick={isFocused ? undefined : () => onNavigate(row.index)}
      >
        <div className={styles.cellInner}>
          {/* Left: breadcrumbs + card */}
          <div className={styles.verticalWrapper}>
            <SmartBreadcrumbs
              items={rowBc}
              compact
              classNameSmartBreadcrumbsContainer={styles.breadcrumbs}
              classNameBreadcrumbItem={styles.crumb}
              classNameBreadcrumbLastItem={styles.crumbLast}
            />
            <div
              className={`${styles.card} ${isFocused ? styles.cardFocused : styles.cardNeighbour}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.cardTitle}>
                {row.registry?.display_name || row.name}
              </div>
              <div className={styles.cardContent}>
                {nearby ? <RowContent row={row} cohortData={cohortData} kdeData={kdeData} /> : null}
              </div>
            </div>
          </div>

          {/* Right: comment cards */}
            <CommentsColumn comments={comments} />
        </div>
      </div>
    );
  },
);

/* ── CommentsColumn ──────────────────────────────────────────────────── */

const DUMMY_COMMENTS: RegistryComment[] = [
  { date: '2026-05-10', user: 'Rule Engine', status: 'accepted', text: '**Prevalence** looks reasonable across all cohorts. No outliers detected.' },
  { date: '2026-05-10', user: 'AI Analyst', status: 'accepted', text: 'The distribution is **consistent** with published literature benchmarks. Consider reviewing the tail values for sensitivity.' },
  { date: '2026-05-10', user: 'QC Bot', status: 'pinned', text: 'Missing data rate is below **2%** — within acceptable thresholds. No imputation required.' },
//   { date: '2026-05-10', user: 'Rule Engine', status: 'accepted', text: '**Prevalence** looks reasonable across all cohorts. No outliers detected.' },
//   { date: '2026-05-10', user: 'AI Analyst', status: 'accepted', text: 'The distribution is **consistent** with published literature benchmarks. Consider reviewing the tail values for sensitivity.' },
//   { date: '2026-05-10', user: 'QC Bot', status: 'pinned', text: 'Missing data rate is below **2%** — within acceptable thresholds. No imputation required.' },
//   { date: '2026-05-10', user: 'Rule Engine', status: 'accepted', text: '**Prevalence** looks reasonable across all cohorts. No outliers detected.' },
//   { date: '2026-05-10', user: 'AI Analyst', status: 'accepted', text: 'The distribution is **consistent** with published literature benchmarks. Consider reviewing the tail values for sensitivity.' },
//   { date: '2026-05-10', user: 'QC Bot', status: 'pinned', text: 'Missing data rate is below **2%** — within acceptable thresholds. No imputation required.' },
];

const CommentsColumn: FC<{ comments: RegistryComment[] }> = ({ comments }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const display = comments.length > 0 ? comments : DUMMY_COMMENTS;

  return (
    <div className={styles.commentsColumn}>
      <div ref={scrollRef} className={styles.commentsScroll}>
        {display.map((comment, i) => (
          <CommentCard key={i} comment={comment} />
        ))}
        <div style={{ minHeight: 30, flexShrink: 0 }} />
      </div>
      <SimpleCustomScrollbar
        targetRef={scrollRef}
        orientation="vertical"
        marginTop={8}
        marginBottom={8}
        marginToEnd={2}
      />
    </div>
  );
};

/* ── CommentCard ─────────────────────────────────────────────────────── */

const CommentCard: FC<{ comment: RegistryComment }> = ({ comment }) => {
  const statusLabel = comment.status === 'pinned' ? '📌' : comment.status === 'resolved' ? '✓' : '';

  return (
    <div className={styles.commentCard} onClick={(e) => e.stopPropagation()}>
      <div className={styles.commentHeader}>
        <span className={styles.commentUser}>{comment.user}</span>
        {statusLabel && <span className={styles.commentStatus}>{statusLabel}</span>}
        <span className={styles.commentDate}>{comment.date}</span>
      </div>
      <div className={styles.commentBody}>
        <ReactMarkdown>{comment.text}</ReactMarkdown>
      </div>
    </div>
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
