import { FC } from 'react';
import { type CohortClassified } from '../types';
import { useBarHoverStore } from './useBarHoverStore';
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
          const row = cd.data.rows.find((r) => r.Name === name);
          const pct = row?.Pct ?? 0;
          const n = row?.N ?? 0;
          const dimmed = activeIndex !== null && activeIndex !== i;

          return (
            <div
              key={i}
              className={styles.cohortRow}
              onClick={() => onClick(i)}
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
    </div>
  );
};
