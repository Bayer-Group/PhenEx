import { FC, useEffect, useRef, useState } from 'react';
import { Portal } from '../../../components/Portal/Portal';
import styles from './CohortNameTooltip.module.css';

interface CohortNameTooltipProps {
  /** Cohort display name. */
  name: string;
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
export const CohortNameTooltip: FC<CohortNameTooltipProps> = ({ name, x, top }) => {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show after 300ms pause, auto-hide after 2s
  useEffect(() => {
    setVisible(false);
    setFading(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    delayTimer.current = setTimeout(() => {
      setVisible(true);
      setFading(false);
      fadeTimer.current = setTimeout(() => setFading(true), 1700);
      hideTimer.current = setTimeout(() => setVisible(false), 2000);
    }, 300);
    return () => {
      if (delayTimer.current) clearTimeout(delayTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [name, x, top]);

  // Hide during scroll / pan / pinch
  useEffect(() => {
    const onActivity = () => {
      setVisible(false);
      if (delayTimer.current) clearTimeout(delayTimer.current);
      if (suppressTimer.current) clearTimeout(suppressTimer.current);
      suppressTimer.current = setTimeout(() => {
        delayTimer.current = setTimeout(() => setVisible(true), 300);
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
        className={`${styles.tooltip} ${fading ? styles.fadeOut : styles.fadeIn}`}
        style={{ left: x, top: top - 4 }}
      >
        {name}
      </div>
    </Portal>
  );
};
