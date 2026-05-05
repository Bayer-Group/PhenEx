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
  const { hoveredIndex, onEnter, onLeave } = useBarHoverStore();

  // Always include the 100 line
  const allTicks = ticks.includes(100) ? ticks : [...ticks, 100];

  return (
    <div className={styles.container}>
      <div className={styles.pctColumn}>
        {cohortData.map((cd, i) => {
          const row = cd.classified.booleans.find((r) => r.Name === name);
          const pct = row?.Pct ?? 0;
          const dimmed = hoveredIndex !== null && hoveredIndex !== i;
          return (
            <div key={i} className={styles.pctRow} style={{ opacity: dimmed ? 0.25 : 1 }}>
              <strong>{Math.round(pct * 10) / 10}</strong>
              {/* <span className={styles.barPercent}>%</span> */}
            </div>
          );
        })}
      </div>

      <div className={styles.barArea}>
        <div className={styles.gridLines}>
          {allTicks.map((t) => (
            <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
          ))}
        </div>

        {cohortData.map((cd, i) => {
          const row = cd.classified.booleans.find((r) => r.Name === name);
          const pct = row?.Pct ?? 0;
          const dimmed = hoveredIndex !== null && hoveredIndex !== i;

          return (
            <div
              key={i}
              className={styles.bar}
              style={{ opacity: dimmed ? 0.25 : 1 }}
              onMouseEnter={() => onEnter(i)}
              onMouseLeave={onLeave}
            >
              <div
                className={styles.barFill}
                style={{ width: `${Math.max(0, pct)}%`, backgroundColor: cd.color }}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.nColumn}>
        {cohortData.map((cd, i) => {
          const row = cd.classified.booleans.find((r) => r.Name === name);
          const n = row?.N ?? 0;
          const dimmed = hoveredIndex !== null && hoveredIndex !== i;
          return (
            <div key={i} className={styles.nRow} style={{ opacity: dimmed ? 0.25 : 1 }}>
              {n}
            </div>
          );
        })}
      </div>
    </div>
  );
};
