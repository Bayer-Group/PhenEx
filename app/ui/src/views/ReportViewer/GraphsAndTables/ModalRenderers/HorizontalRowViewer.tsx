import { FC, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { type SequentialRow, type RegistryComment } from '../../studyRegistryUtils';
import { Portal } from '../../../../components/Portal/Portal';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { BarChartCellRenderer } from '../RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from '../RowRenderers/CategoricalBarChartCellRenderer';
import { NumericContent } from './NumericContent';
import booleanStyles from './BooleanRowModal.module.css';
import categoricalStyles from './CategoricalRowModal.module.css';
import styles from './HorizontalRowViewer.module.css';
import { HorizontalRowTitle } from './HorizontalRowTitle';
import ReactMarkdown from 'react-markdown';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';

// ── Constants ───────────────────────────────────────────────────────────

const ANIM_MS = 150;
const RENDER_NEIGHBOURS = 3; // only render chart content for cells within this range
const PRERENDER_NEIGHBOURS = RENDER_NEIGHBOURS + 1; // pre-render one extra so content is ready before scroll lands
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
  cohortDataMap: Record<string, CohortClassified[]>;
  studyTitle?: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onScrollToRow?: (el: HTMLElement | null) => void;
}

// ── Component ───────────────────────────────────────────────────────────

export const HorizontalRowViewer: FC<HorizontalRowViewerProps> = ({
  rows,
  currentIndex,
  cohortDataMap,
  studyTitle,
  onClose,
  onNavigate,
  onScrollToRow,
}) => {
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const hasNavigated = useRef(false);
  const holdDir = useRef<-1 | 0 | 1>(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  const centerOnCard = useCallback((idx: number, mode: 'instant' | 'smooth' | 'fast') => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const child = scroller.children[idx] as HTMLElement | undefined;
    if (!child) return;
    const target = Math.max(0, child.offsetLeft - (scroller.clientWidth - child.offsetWidth) / 2);
    if (mode === 'instant') {
      scroller.scrollLeft = target;
    } else if (mode === 'smooth') {
      scroller.scrollTo({ left: target, behavior: 'smooth' });
    } else {
      // Fast ease-out animation (~150ms)
      const start = scroller.scrollLeft;
      const dist = target - start;
      if (Math.abs(dist) < 1) { scroller.scrollLeft = target; return; }
      const duration = 150;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - t0) / duration, 1);
        scroller.scrollLeft = start + dist * (1 - (1 - p) * (1 - p));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, []);

  // Fast scroll on single-press navigate
  useEffect(() => {
    if (!didInitialScroll.current) return;
    if (holdDir.current !== 0) return;
    requestAnimationFrame(() => centerOnCard(currentIndex, 'fast'));
  }, [currentIndex, centerOnCard]);

  // Instant scroll on mount
  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    centerOnCard(currentIndex, 'instant');
  }, [centerOnCard, currentIndex]);

  // ── Step-and-pause while holding arrow key ────────────────────────────

  /** Scroll animation duration + pause duration at each card while holding */
  const HOLD_SCROLL_MS = 150;
  const HOLD_PAUSE_MS = 300;

  const stepHold = useCallback(() => {
    const dir = holdDir.current;
    if (dir === 0) return;
    const next = currentIndex + dir;
    if (next < 0 || next >= rows.length) { holdDir.current = 0; return; }
    hasNavigated.current = true;
    onNavigate(next);
  }, [currentIndex, rows.length, onNavigate]);

  // When currentIndex changes while holding, animate to card then schedule next step
  useEffect(() => {
    if (holdDir.current === 0) return;
    centerOnCard(currentIndex, 'fast');
    holdTimer.current = setTimeout(stepHold, HOLD_SCROLL_MS + HOLD_PAUSE_MS);
    return () => clearTimeout(holdTimer.current);
  }, [currentIndex, centerOnCard, stepHold]);

  const startHold = useCallback((dir: -1 | 1) => {
    holdDir.current = dir;
    stepHold();
  }, [stepHold]);

  const stopHold = useCallback(() => {
    holdDir.current = 0;
    clearTimeout(holdTimer.current);
    // Smooth-settle on whichever card is current
    requestAnimationFrame(() => centerOnCard(currentIndex, 'smooth'));
  }, [centerOnCard, currentIndex]);

  // Clean up on unmount
  useEffect(() => () => clearTimeout(holdTimer.current), []);

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') startClose();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.repeat) {
          if (holdDir.current === 0) startHold(-1);
        } else if (currentIndex > 0) {
          navigate(currentIndex - 1);
        }
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.repeat) {
          if (holdDir.current === 0) startHold(1);
        } else if (currentIndex < rows.length - 1) {
          navigate(currentIndex + 1);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && holdDir.current !== 0) {
        stopHold();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [startClose, currentIndex, rows.length, navigate, startHold, stopHold]);

  if (!current) return null;

  return (
    <Portal>
      <div
        className={`${styles.overlay} ${closing ? styles.closing : ''}`}
        onClick={startClose}
      >
        {/* Floating title above cards */}
        <HorizontalRowTitle
          rows={rows}
          currentIndex={currentIndex}
          desiredTop={desiredTop}
          studyTitle={studyTitle}
          onNavigate={navigate}
        />

        {/* Horizontal strip of cards — all cells in DOM, only nearby ones render content */}
        <div className={styles.scroller} ref={scrollRef} style={{ gap: CELL_GAP }}>
          {rows.map((row) => {
            const isFocused = row.index === currentIndex;
            const nearby = Math.abs(row.index - currentIndex) <= PRERENDER_NEIGHBOURS;
            return (
              <HorizontalCell
                key={row.index}
                ref={isFocused ? focusedRef : null}
                row={row}
                isFocused={isFocused}
                nearby={nearby}
                desiredTop={desiredTop}
                cohortDataMap={cohortDataMap}
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
  cohortDataMap: Record<string, CohortClassified[]>;
  onNavigate: (index: number) => void;
}

const HorizontalCell = forwardRef<HTMLDivElement, HorizontalCellProps>(
  ({ row, isFocused, nearby, desiredTop, cohortDataMap, onNavigate }, ref) => {
    const cohortData = cohortDataMap[row.reporter] ?? [];
    const kdeData = useMemo(() => {
      const result: Record<string, Record<string, KdeCurve>> = {};
      for (const cd of cohortData) {
        if (cd.data.kdes) result[cd.name] = cd.data.kdes;
      }
      return result;
    }, [cohortData]);

    // Comments are stored inline on the registry row
    const comments = useMemo(() => {
      return row.registry?.comments?.filter((c) => c.text) ?? [];
    }, [row.registry]);

    return (
      <div
        ref={ref}
        className={styles.cell}
        style={{ '--desired-top': desiredTop } as React.CSSProperties}
        onClick={isFocused ? undefined : () => onNavigate(row.index)}
      >
        <div className={styles.cellInner}>
          {/* Left: card */}
          <div className={styles.verticalWrapper}>
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

const CommentsColumn: FC<{ comments: RegistryComment[] }> = ({ comments }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.commentsColumn}>
      <div ref={scrollRef} className={styles.commentsScroll}>
        {comments.map((comment, i) => (
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
  const label = comment.type ?? comment.user ?? '';
  const statusLabel = comment.status === 'pinned' ? '📌' : comment.status === 'resolved' ? '✓' : '';

  return (
    <div className={styles.commentCard} onClick={(e) => e.stopPropagation()}>
      <div className={styles.commentHeader}>
        <span className={styles.commentUser}>{label}</span>
        {statusLabel && <span className={styles.commentStatus}>{statusLabel}</span>}
        {comment.date && <span className={styles.commentDate}>{comment.date}</span>}
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


