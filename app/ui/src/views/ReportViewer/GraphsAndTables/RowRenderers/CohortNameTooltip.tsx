import { FC, useEffect, useRef, useState } from 'react';
import { Portal } from '../../../../components/Portal/Portal';
import { type CohortClassified, getCohortLabelParts } from '../../types';
import styles from './CohortNameTooltip.module.css';

interface CohortLabel {
  parent: string;
  sub: string | null;
  color: string;
}

/**
 * Resolve the box-plot-style parent/sub label parts (and parent color) for a
 * cohort at the given index. Mirrors BoxPlotCellRenderer's getCohortLabel.
 */
function getCohortLabel(cohortData: CohortClassified[], index: number): CohortLabel {
  const cohort = cohortData[index];
  if (!cohort) return { parent: '', sub: null, color: '' };
  const getDisplayName = (n: string) => cohortData.find((c) => c.name === n)?.displayName;
  const { parent, sub } = getCohortLabelParts(cohort.name, getDisplayName);
  const parentIdx = cohort.name.indexOf('__');
  const parentCohort =
    parentIdx !== -1 ? cohortData.find((c) => c.name === cohort.name.substring(0, parentIdx)) : null;
  return { parent, sub, color: parentCohort?.color ?? cohort.color };
}

interface CohortNameTooltipProps {
  /** All cohorts (used to resolve parent/sub label parts and color). */
  cohortData: CohortClassified[];
  /** Index of the hovered cohort within cohortData. */
  index: number;
  /** Fixed-position X (clientX from mouse event). */
  x: number;
  /** Fixed-position Y — tooltip renders above this point. */
  top: number;
}

/**
 * Floating cohort-name tooltip rendered via Portal.
 *
 * Automatically hides during scroll / trackpad pan / pinch-zoom
 * so it never appears stuck in the wrong position.
 */
export const CohortNameTooltip: FC<CohortNameTooltipProps> = ({ cohortData, index, x, top }) => {
  const label = getCohortLabel(cohortData, index);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show immediately, auto-hide after 2s
  useEffect(() => {
    setFading(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setVisible(true);
    fadeTimer.current = setTimeout(() => setFading(true), 1700);
    hideTimer.current = setTimeout(() => setVisible(false), 2000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [index, x, top]);

  // Hide during scroll / pan / pinch
  useEffect(() => {
    const onActivity = () => {
      setVisible(false);
      if (suppressTimer.current) clearTimeout(suppressTimer.current);
      suppressTimer.current = setTimeout(() => {
        setVisible(true);
      }, 150);
    };

    window.addEventListener('wheel', onActivity, { passive: true });
    window.addEventListener('gesturechange', onActivity, { passive: true });
    window.addEventListener('mousemove', onDragCheck, { passive: true });

    function onDragCheck(e: MouseEvent) {
      if (e.buttons !== 0) onActivity();
    }

    return () => {
      window.removeEventListener('wheel', onActivity);
      window.removeEventListener('gesturechange', onActivity);
      window.removeEventListener('mousemove', onDragCheck);
      if (suppressTimer.current) clearTimeout(suppressTimer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <Portal>
      <div
        className={`${styles.tooltipWrapper} ${fading ? styles.fadeOut : styles.fadeIn}`}
        style={{ left: x, top: top - 4 }}
      >
        <div className={styles.tooltipCohort} style={{ color: label.color }}>
          <div className={styles.tooltipParent}>{label.parent}</div>
          {label.sub && <div className={styles.tooltipSub}>{label.sub}</div>}
        </div>
      </div>
    </Portal>
  );
};
