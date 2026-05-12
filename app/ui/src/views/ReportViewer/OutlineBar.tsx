import { FC, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './OutlineBar.module.css';

export interface OutlineEntry {
  name: string;
  level: number; // 0 = top-level group, 1 = subsection
  onClick: () => void;
}

interface OutlineBarProps {
  entries: OutlineEntry[];
  activeSection?: string | null;
}

export const OutlineBar: FC<OutlineBarProps> = ({ entries, activeSection }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [portalPos, setPortalPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseEnter = useCallback(() => {
    const rect = barRef.current?.getBoundingClientRect();
    if (rect) {
      setPortalPos({ x: rect.left, y: rect.top });
    }
    setHover(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHover(false);
  }, []);

  const TICK_H = 4;
  const GAP = 14; /* match to css .bar*/
  const totalH = entries.length * (TICK_H + GAP) - GAP;

  return (
    <>
      <div
        ref={barRef}
        className={styles.bar}
        style={{ height: totalH }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {entries.map((entry, i) => {
          const isActive = activeSection === entry.name;
          const width = entry.level === 0 ? 12 +20: 20;
          return (
            <div
              key={`${entry.name}-${i}`}
              className={`${styles.tick} ${isActive ? styles.tickActive : ''}`}
              style={{ width, height: TICK_H }}
              onClick={entry.onClick}
            />
          );
        })}
      </div>

      {hover && portalPos && createPortal(
        <div
          className={styles.portal}
          style={{ top: portalPos.y, left: portalPos.x }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {entries.map((entry, i) => {
            const isActive = activeSection === entry.name;
            return (
              <button
                key={`${entry.name}-${i}`}
                className={`${styles.portalItem} ${isActive ? styles.portalItemActive : ''}`}
                style={{ paddingLeft: entry.level === 0 ? 8 : 20 }}
                onClick={entry.onClick}
              >
                {entry.name}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
};
