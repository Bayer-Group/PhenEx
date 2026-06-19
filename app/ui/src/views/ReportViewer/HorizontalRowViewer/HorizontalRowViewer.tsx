import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { type CohortClassified } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import styles from './HorizontalRowViewer.module.css';
import { useThreePanelCollapse } from '../../../contexts/ThreePanelCollapseContext';
import { HorizontalCell } from './HorizontalCell';
import { HorizontalRowTitle } from './HorizontalRowTitle';
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
}

// ── Component ───────────────────────────────────────────────────────────

export const HorizontalRowViewer: FC<HorizontalRowViewerProps> = ({
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
}) => {
  const { isLeftPanelShown } = useThreePanelCollapse();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [closing, setClosing] = useState(false);
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  const [showRowTitle, setShowRowTitle] = useState(false);
  const [commentsPanelWidth, setCommentsPanelWidth] = useState(() => {
    try {
      const stored = localStorage.getItem('phenex_two_panel_right_width');
      if (stored) return parseInt(stored, 10) || 300;
    } catch { /* ignore */ }
    return 300;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const mouseDownOnOverlay = useRef(false);
  const holdDir = useRef<-1 | 0 | 1>(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountY = useRef(lastClickY);
  const sharedScrollTopRef = useRef(0);

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

  const current = rows[currentIndex];
  const desiredTop = `${Math.min(Math.round(mountY.current * 60), 40)}vh`;

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
    setCurrentIndex(next);
  }, [currentIndex, rows.length]);

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
    setCurrentIndex(index);
  }, []);

  const handleVerticalScroll = useCallback((scrollTop: number, threshold: number) => {
    setShowRowTitle(scrollTop > threshold);
    sharedScrollTopRef.current = scrollTop;
  }, []);

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

      <div className={styles.titleGroup} style={{ marginLeft: isLeftPanelShown ? undefined : 50 }} onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button className={styles.backButton} onClick={(e) => { e.stopPropagation(); startClose(); }} title="Back">
            <svg width="20" height="22" viewBox="0 0 25 28" fill="none">
              <path d="M17 25L10.34772 14.0494C10.15571 13.8507 10.16118 13.534 10.35992 13.3422L17 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <div className={`${styles.titleBar} ${showRowTitle ? styles.titleBarScrolled : ''}`}>
          <HorizontalRowTitle
            rows={rows}
            currentIndex={currentIndex}
            desiredTop={desiredTop}
            studyTitle={studyTitle}
            onNavigate={navigate}
          />
        </div>
      </div>
      {showRowTitle && (
        <div className={styles.rowTitleLabel} style={{ marginLeft: isLeftPanelShown ? 22 : 62 }} onClick={(e) => e.stopPropagation()}>
          {current.registry?.display_name || current.name}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div className={styles.scroller} ref={scrollRef} style={{ height: '100%' }}>
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
                onVerticalScroll={isFocused ? handleVerticalScroll : undefined}
                initialScrollTop={sharedScrollTopRef.current}
                commentsCollapsed={commentsCollapsed}
                onCommentsCollapsedChange={setCommentsCollapsed}
                commentsPanelWidth={commentsPanelWidth}
                onCommentsPanelWidthChange={setCommentsPanelWidth}
                studyTitle={studyTitle}
                studyDescription={studyDescription}
              />
            );
          })}
        </div>
      </div>
      <div className={styles.navPillContainer}>
        <NavPill currentIndex={currentIndex} total={rows.length} onNavigate={navigate} />
      </div>
      {/* <div className={styles.commentBarContainer}>
        <CommentBar
          commentsCollapsed={commentsCollapsed}
          onToggleCollapsed={() => setCommentsCollapsed(!commentsCollapsed)}
          onNewComment={() => setShowCommentWindow(true)}
        />
      </div>
      {showCommentWindow && (
        <CommentWindow
          onClose={() => setShowCommentWindow(false)}
          onSave={(text) => {
            console.log('Comment saved:', text);
            setShowCommentWindow(false);
          }}
          onAskAI={(text) => {
            console.log('Ask AI:', text);
          }}
        />
      )} */}
      {/* <div className={styles.fakeDataLabel}>FAKE DATA</div> */}
    </div>
  );
};

