import { FC, useState, useRef } from 'react';
import { type CohortClassified } from '../types';
import { useBarHoverStore } from './useBarHoverStore';
import { CohortNameTooltip } from './CohortNameTooltip';
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
  const { activeIndex, onClick } = useBarHoverStore();
  const [hover, setHover] = useState<{ index: number; x: number; top: number } | null>(null);
  const barRefs = useRef<Record<number, HTMLDivElement>>({});

  // Always include the 100 line
  const allTicks = ticks.includes(100) ? ticks : [...ticks, 100];

  return (
    <div className={styles.container}>
      {/* Header row */}
      <div className={styles.headerRow}>
        <div className={styles.headerPct}>%</div>
        <div className={styles.headerBar}>
          {[0, 20, 40, 60, 80, 100].map((t) => (
            <span key={t} className={styles.headerTick} style={{ left: `${t}%` }}>{t}</span>
          ))}
        </div>
        <div className={styles.headerN}>N</div>
      </div>

      {/* Grid lines positioned over the bar column */}
      <div className={styles.rows}>
        <div className={styles.gridOverlay} style={{ left: '0%', width: '100%' }}>
          {allTicks.map((t) => (
            <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
          ))}
        </div>
        {cohortData.map((cd, i) => {
          const row = cd.data.rows.find((r) => r.Name === name);
          const pct = row?.Pct ?? 0;
          const n = row?.N ?? 0;
          const dimmed = activeIndex !== null && activeIndex !== i;

          return (
            <div
              key={i}
              ref={(el) => { if (el) barRefs.current[i] = el; }}
              className={styles.cohortRow}
              onClick={() => onClick(i)}
              onMouseEnter={(e) => {
                const rect = barRefs.current[i]?.getBoundingClientRect();
                if (rect) setHover({ index: i, x: e.clientX, top: rect.top });
              }}
              onMouseMove={(e) => {
                const rect = barRefs.current[i]?.getBoundingClientRect();
                if (rect) setHover({ index: i, x: e.clientX, top: rect.top });
              }}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
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
              <div className={styles.nCell} style={{ opacity: dimmed ? 0.25 : 1, color: activeIndex === i ? '#000' : undefined }}>
                {n.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {hover && (
        <CohortNameTooltip
          name={cohortData[hover.index]?.name ?? ''}
          x={hover.x}
          top={hover.top}
        />
      )}
    </div>
  );
};
