import { FC, useRef } from 'react';
import { type CohortClassified } from '../types';
import { useBarHoverStore } from './useBarHoverStore';
import { Portal } from '../../../components/Portal/Portal';
import styles from './BarChartCellRenderer.module.css';

const DEFAULT_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

interface BarChartCellRendererProps {
  data: {
    name: string;
    _meta: {
      cohortData: CohortClassified[];
      ticks?: number[];
    };
  };
}

export const BarChartCellRenderer: FC<BarChartCellRendererProps> = ({ data }) => {
  const { cohortData, ticks = DEFAULT_TICKS } = data._meta;
  const { name } = data;
  const { hoveredIndex, mouseX, onEnter, onMove, onLeave } = useBarHoverStore();
  const isLocalHover = useRef(false);
  const barRefs = useRef<Record<number, HTMLDivElement>>({});

  // Always include the 100 line
  const allTicks = ticks.includes(100) ? ticks : [...ticks, 100];

  return (
    <div className={styles.container}>
      {/* Grid lines positioned over the bar column */}
      <div className={styles.gridOverlay} style={{ left: '15%', width: '60%' }}>
        {allTicks.map((t) => (
          <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
        ))}
      </div>

      <div className={styles.rows}>
        {cohortData.map((cd, i) => {
          const row = cd.classified.booleans.find((r) => r.Name === name);
          const pct = row?.Pct ?? 0;
          const n = row?.N ?? 0;
          const dimmed = hoveredIndex !== null && hoveredIndex !== i;

          return (
            <div
              key={i}
              ref={(el) => { if (el) barRefs.current[i] = el; }}
              className={styles.cohortRow}
              onMouseEnter={(e) => { isLocalHover.current = true; onEnter(i, e); }}
              onMouseMove={onMove}
              onMouseLeave={() => { isLocalHover.current = false; onLeave(); }}
            >
              <div className={styles.pctCell} style={{ opacity: dimmed ? 0.25 : 1 }}>
                <strong>{Math.round(pct * 10) / 10}</strong>
              </div>
              <div className={styles.barCell} style={{ opacity: dimmed ? 0.25 : 1 }}>
                <div
                  className={styles.barFill}
                  style={{ width: `${Math.max(0, pct)}%`, backgroundColor: cd.color }}
                />
              </div>
              <div className={styles.nCell} style={{ opacity: dimmed ? 0.25 : 1, color: hoveredIndex === i ? '#000' : undefined }}>
                {n.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {isLocalHover.current && hoveredIndex !== null && (() => {
        const barEl = barRefs.current[hoveredIndex];
        if (!barEl) return null;
        const rect = barEl.getBoundingClientRect();
        return (
          <Portal>
            <div
              className={styles.tooltip}
              style={{ left: mouseX, top: rect.top - 4 }}
            >
              {cohortData[hoveredIndex]?.name}
            </div>
          </Portal>
        );
      })()}
    </div>
  );
};
