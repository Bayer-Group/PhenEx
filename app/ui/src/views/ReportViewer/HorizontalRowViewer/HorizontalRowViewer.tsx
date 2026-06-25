import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type CohortClassified } from '../types';
import { type SequentialRow, type ViewerEntry } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import styles from './HorizontalRowViewer.module.css';
import { useThreePanelCollapse } from '../../../contexts/ThreePanelCollapseContext';
import { HorizontalCell } from './HorizontalCell';
import { NavPill } from './NavPill';

// ── Constants ───────────────────────────────────────────────────────────

const ANIM_MS = 150;
const RENDER_NEIGHBOURS = 3;
const PRERENDER_NEIGHBOURS = RENDER_NEIGHBOURS + 1;

/** Track the last click Y so cards appear at the caller's position. */
let lastClickY = 0.1;
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    lastClickY = e.clientY / window.innerHeight;
  }, true);
}

// ── Props ───────────────────────────────────────────────────────────────

interface HorizontalRowViewerProps {
  /** Navigable units: single rows and multi-row section cells. */
  entries: ViewerEntry[];
  /** Flat sequential rows, used for cross-row lookups (e.g. TTE outcomes). */
  rows: SequentialRow[];
  initialIndex: number;
  cohortDataMap: Record<string, CohortClassified[]>;
  finalCohortSizes?: Record<string, number | null>;
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  studyTitle?: string;
  studyDescription?: string;
  onClose?: (finalIndex: number) => void;
  navigateToIndex?: number;
  onIndexChange?: (index: number) => void;
  onNavigateToRow?: (row: SequentialRow) => void;
  onScrolledPastTitle?: (scrolled: boolean) => void;
}

// ── Component ───────────────────────────────────────────────────────────

export const HorizontalRowViewer = memo<HorizontalRowViewerProps>(({
  entries,
  rows,
  initialIndex,
  cohortDataMap,
  finalCohortSizes,
  tteCohorts,
  table2Cohorts,
  studyTitle,
  studyDescription,
  onClose,
  navigateToIndex,
  onIndexChange,
  onNavigateToRow,
  onScrolledPastTitle,
}) => {
  const { isLeftPanelShown } = useThreePanelCollapse();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const mouseDownOnOverlay = useRef(false);
  const holdDir = useRef<-1 | 0 | 1>(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountY = useRef(lastClickY);
  const sharedScrollTopRef = useRef(0);
  const cachedScrollerWidth = useRef(0);

  // Sync external navigation requests (e.g. from OutlinePanel)
  const prevExternalIndex = useRef(initialIndex);
  useEffect(() => {
    if (navigateToIndex !== undefined && navigateToIndex !== prevExternalIndex.current) {
      prevExternalIndex.current = navigateToIndex;
      setCurrentIndex(navigateToIndex);
    }
  }, [navigateToIndex]);

  // Report index changes to parent (for outline highlighting)
  useEffect(() => {
    onIndexChange?.(currentIndex);
  }, [currentIndex, onIndexChange]);

  const current = entries[currentIndex];

  // ── Scroll management ─────────────────────────────────────────────────
  // Each cell is exactly 100% width of the scroller, so we can compute
  // positions mathematically without reading DOM offsets (avoids forced reflow).

  const centerOnCard = useCallback((idx: number, mode: 'instant' | 'smooth' | 'fast') => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    // Use cached width to avoid forced reflow; fallback to reading if not yet set
    const cellWidth = cachedScrollerWidth.current || scroller.clientWidth;
    if (cellWidth === 0) return;
    const target = idx * cellWidth;
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

  // Fast scroll on single-press navigate — use layoutEffect to set scroll
  // position before paint, avoiding visual flash from spacer width changes.
  useLayoutEffect(() => {
    if (!didInitialScroll.current) return;
    if (holdDir.current !== 0) return;
    centerOnCard(currentIndex, 'fast');
  }, [currentIndex, centerOnCard]);

  // Instant scroll on mount
  useLayoutEffect(() => {
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
    if (next < 0 || next >= entries.length) { holdDir.current = 0; return; }
    setCurrentIndex(next);
  }, [currentIndex, entries.length]);

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

  // Keep a ref to currentIndex for use in ResizeObserver (avoids re-creating it on nav)
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Re-center when the scroller (center panel) resizes or window resizes
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const ro = new ResizeObserver((roEntries) => {
      const roEntry = roEntries[0];
      if (roEntry) cachedScrollerWidth.current = roEntry.contentRect.width;
      centerOnCard(currentIndexRef.current, 'instant');
    });
    ro.observe(scroller);
    // Initialize cached width
    cachedScrollerWidth.current = scroller.clientWidth;
    return () => ro.disconnect();
  }, [centerOnCard]);

  // Re-center when switching between Focus/Compact (left panel toggle)
  // The ResizeObserver handles width changes, but there's a timing issue
  // where the panel collapses with an animation, so also re-center here.
  useEffect(() => {
    centerOnCard(currentIndexRef.current, 'instant');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLeftPanelShown, centerOnCard]);

  // The set of cells changes as the outline accordion expands/collapses; the
  // focused card's offset shifts, so snap it back to center instantly.
  useEffect(() => {
    centerOnCard(currentIndexRef.current, 'instant');
  // Only re-run when entries change (accordion toggle), not on every navigation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, centerOnCard]);

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
    setCurrentIndex(index);
  }, []);

  const handleVerticalScroll = useCallback((scrollTop: number, threshold: number) => {
    onScrolledPastTitle?.(scrollTop > threshold);
    sharedScrollTopRef.current = scrollTop;
  }, [onScrolledPastTitle]);

  const startClose = useCallback(() => {
    if (!onClose || closing) return;
    setClosing(true);
    setTimeout(() => onClose(currentIndex), ANIM_MS);
  }, [closing, onClose, currentIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) startClose();
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
        } else if (currentIndex < entries.length - 1) {
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
  }, [startClose, currentIndex, entries.length, navigate, startHold, stopHold]);

  // ── FlexLayout removed — outline is now in ReportViewer's left panel ──

  if (!current) return null;

  // const handleOverlayClick = useCallback(() => {
  //   if (!mouseDownOnOverlay.current) return;
  //   mouseDownOnOverlay.current = false;
  //   startClose();
  // }, [startClose]);

  return (
    <div
      className={`${styles.overlay} ${closing ? styles.closing : ''}`}
      onMouseDown={() => { mouseDownOnOverlay.current = true; }}
      // onClick={handleOverlayClick}
    >
      <div className={styles.topGradient} />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div className={styles.scroller} ref={scrollRef} style={{ height: '100%' }}>
          {/* Virtualized: only render cells within the visible window */}
          {(() => {
            const windowStart = Math.max(0, currentIndex - PRERENDER_NEIGHBOURS);
            const windowEnd = Math.min(entries.length - 1, currentIndex + PRERENDER_NEIGHBOURS);
            const cells = [];
            for (let i = windowStart; i <= windowEnd; i++) {
              const entry = entries[i];
              const isFocused = i === currentIndex;
              const nearby = true; // all rendered cells are nearby by definition
              cells.push(
                <HorizontalCell
                  key={entry.key}
                  ref={isFocused ? focusedRef : null}
                  entry={entry}
                  entries={entries}
                  rows={rows}
                  isFocused={isFocused}
                  nearby={nearby}
                  cohortDataMap={cohortDataMap}
                  finalCohortSizes={finalCohortSizes}
                  tteCohorts={tteCohorts}
                  table2Cohorts={table2Cohorts}
                  onNavigate={navigate}
                  onNavigateToRow={onNavigateToRow}
                  onVerticalScroll={isFocused ? handleVerticalScroll : undefined}
                  initialScrollTop={sharedScrollTopRef.current}
                  studyTitle={studyTitle}
                  studyDescription={studyDescription}
                />
              );
            }
            return (
              <>
                {/* Left spacer: represents all cells before the window */}
                {windowStart > 0 && (
                  <div style={{ flexShrink: 0, width: `${windowStart * 100}%`, minWidth: `${windowStart * 100}%` }} />
                )}
                {cells}
                {/* Right spacer: represents all cells after the window */}
                {windowEnd < entries.length - 1 && (
                  <div style={{ flexShrink: 0, width: `${(entries.length - 1 - windowEnd) * 100}%`, minWidth: `${(entries.length - 1 - windowEnd) * 100}%` }} />
                )}
              </>
            );
          })()}
        </div>
      </div>
      <div className={styles.navPillContainer}>
        <NavPill currentIndex={currentIndex} total={entries.length} onNavigate={navigate} />
      </div>
    </div>
  );
});

