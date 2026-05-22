import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import styles from './HorizontalRowViewer.module.css';
import { useThreePanelCollapse } from '../../../contexts/ThreePanelCollapseContext';
import { HorizontalCell } from './HorizontalCell';

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
  finalCohortSizes?: Record<string, number | null>;
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
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
  finalCohortSizes,
  tteCohorts,
  table2Cohorts,
  studyTitle,
  onClose,
  onNavigate,
  onScrollToRow,
}) => {
  const { isLeftPanelShown } = useThreePanelCollapse();
  const [closing, setClosing] = useState(false);
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const mouseDownOnOverlay = useRef(false);
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

  // Re-center when the scroller (center panel) resizes or window resizes
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const ro = new ResizeObserver(() => centerOnCard(currentIndex, 'instant'));
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [currentIndex, centerOnCard]);

  // Re-center when switching between Focus/Compact (left panel toggle)
  useEffect(() => {
    requestAnimationFrame(() => centerOnCard(currentIndex, 'instant'));
  }, [isLeftPanelShown, centerOnCard, currentIndex]);

  // Block horizontal wheel scrolling of the scroller — vertical scroll
  // is handled natively by the overflow-y:auto verticalWrapper elements.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      // Only block if the wheel would scroll the scroller horizontally
      if (e.deltaX !== 0) e.preventDefault();
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

  const handleOverlayClick = useCallback(() => {
    if (!mouseDownOnOverlay.current) return;
    mouseDownOnOverlay.current = false;
    startClose();
  }, [startClose]);

  return (
    <div
      className={`${styles.overlay} ${closing ? styles.closing : ''}`}
      onMouseDown={() => { mouseDownOnOverlay.current = true; }}
      onClick={handleOverlayClick}
    >
      <div className={styles.scroller} ref={scrollRef}>
        {rows.map((row) => {
          const isFocused = row.index === currentIndex;
          const nearby = Math.abs(row.index - currentIndex) <= PRERENDER_NEIGHBOURS;
          return (
            <HorizontalCell
              key={row.index}
              ref={isFocused ? focusedRef : null}
              row={row}
              rows={rows}
              isFocused={isFocused}
              nearby={nearby}
              desiredTop={desiredTop}
              cohortDataMap={cohortDataMap}
              finalCohortSizes={finalCohortSizes}
              tteCohorts={tteCohorts}
              table2Cohorts={table2Cohorts}
              onNavigate={navigate}
              commentsCollapsed={commentsCollapsed}
              studyTitle={studyTitle}
            />
          );
        })}
      </div>
    </div>
  );
};

