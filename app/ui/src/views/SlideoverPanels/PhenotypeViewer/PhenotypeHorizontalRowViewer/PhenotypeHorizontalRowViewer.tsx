import { FC, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './PhenotypeHorizontalRowViewer.module.css';
import { Phenotype, PhenotypeDataService } from '../PhenotypeDataService';
import { PhenotypeViewerHorizontalCell } from './PhenotypeViewerHorizontalCell';

interface PhenotypeHorizontalRowViewerProps {
  /** The phenotype to open initially (and whenever it changes externally). */
  data: Phenotype;
  /** Close the viewer. */
  onClose: () => void;
}

/** Number of neighbouring cards rendered on each side for the scroll effect. */
const RENDER_NEIGHBOURS = 1;

/**
 * Full-screen, horizontally paged phenotype viewer. Works like the report's
 * `HorizontalRowViewer`: each phenotype is a full-width card and the user pages
 * between them with the arrow keys. The list and order of phenotypes come from
 * the `CohortDataService` (via `PhenotypeDataService.getNavigablePhenotypes`).
 */
export const PhenotypeHorizontalRowViewer: FC<PhenotypeHorizontalRowViewerProps> = ({
  data,
  onClose,
}) => {
  const dataService = PhenotypeDataService.getInstance();
  const phenotypes = dataService.getNavigablePhenotypes();

  const indexOfData = () => {
    const idx = phenotypes.findIndex(p => p.id === data.id);
    return idx >= 0 ? idx : 0;
  };

  const [currentIndex, setCurrentIndex] = useState(indexOfData);
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cellWidthRef = useRef(0);

  // Keep the shared PhenotypeDataService pointed at the focused phenotype so its
  // parameter grid and component table reflect the current card.
  const current = phenotypes[currentIndex];
  useEffect(() => {
    if (current) dataService.setData(current);
  }, [current, dataService]);

  // Sync to external phenotype changes (e.g. clicking an ancestor breadcrumb).
  useEffect(() => {
    const idx = phenotypes.findIndex(p => p.id === data.id);
    if (idx >= 0 && idx !== currentIndex) setCurrentIndex(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id]);

  // ── Horizontal scroll positioning ──────────────────────────────────────
  const centerOnCard = useCallback((idx: number, mode: 'instant' | 'fast') => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const width = cellWidthRef.current || scroller.clientWidth;
    if (!width) return;
    const target = idx * width;
    if (mode === 'instant') {
      scroller.scrollLeft = target;
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

  useLayoutEffect(() => {
    centerOnCard(currentIndex, 'fast');
  }, [currentIndex, centerOnCard]);

  // Track scroller width and re-center on resize (no forced reflow on nav).
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    cellWidthRef.current = scroller.clientWidth;
    centerOnCard(currentIndex, 'instant');
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) cellWidthRef.current = entry.contentRect.width;
      centerOnCard(currentIndex, 'instant');
    });
    ro.observe(scroller);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerOnCard]);

  // ── Close / keyboard navigation ────────────────────────────────────────
  const startClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 150);
  }, [closing, onClose]);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      setCurrentIndex(idx => {
        const next = idx + dir;
        return next < 0 || next >= phenotypes.length ? idx : next;
      });
    },
    [phenotypes.length]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        startClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigate(1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate, startClose]);

  if (!current) return null;

  const windowStart = Math.max(0, currentIndex - RENDER_NEIGHBOURS);
  const windowEnd = Math.min(phenotypes.length - 1, currentIndex + RENDER_NEIGHBOURS);
  const cells = [];
  for (let i = windowStart; i <= windowEnd; i++) {
    const phenotype = phenotypes[i];
    cells.push(
      <div
        key={phenotype.id ?? i}
        style={{
          flexShrink: 0,
          width: '100%',
          minWidth: '100%',
          height: '100%',
          opacity: i === currentIndex ? 1 : 0.45,
          transition: 'opacity 0.15s ease',
        }}
      >
        <PhenotypeViewerHorizontalCell
          data={phenotype}
          isFocused={i === currentIndex}
          onClose={startClose}
        />
      </div>
    );
  }

  return createPortal(
    <div className={`${styles.overlay} ${closing ? styles.closing : ''}`}>
      <button className={styles.backButton} onClick={startClose} title="Close (Esc)">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className={styles.scroller} ref={scrollRef}>
        {windowStart > 0 && (
          <div className={styles.spacer} style={{ width: `${windowStart * 100}%` }} />
        )}
        {cells}
        {windowEnd < phenotypes.length - 1 && (
          <div
            className={styles.spacer}
            style={{ width: `${(phenotypes.length - 1 - windowEnd) * 100}%` }}
          />
        )}
      </div>

      {phenotypes.length > 1 && (
        <div className={styles.navPill}>
          <button
            className={styles.navButton}
            disabled={currentIndex === 0}
            onClick={() => navigate(-1)}
            title="Previous (←)"
          >
            ‹
          </button>
          <span className={styles.navCounter}>
            {currentIndex + 1} / {phenotypes.length}
          </span>
          <button
            className={styles.navButton}
            disabled={currentIndex === phenotypes.length - 1}
            onClick={() => navigate(1)}
            title="Next (→)"
          >
            ›
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};
