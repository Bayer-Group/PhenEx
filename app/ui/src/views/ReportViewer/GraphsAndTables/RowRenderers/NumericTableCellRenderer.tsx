import { FC, useState, useRef } from 'react';
import { type CohortClassified } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import { CohortNameTooltip } from './CohortNameTooltip';
import styles from './NumericTableCellRenderer.module.css';

const STAT_KEYS = ['Min', 'Mean', 'STD', 'Median', 'Max'] as const;

const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return '–';
  return v % 1 !== 0 ? v.toFixed(1) : String(v);
};

interface NumericTableCellRendererProps {
  name: string;
  cohortData: CohortClassified[];
  hideNPct?: boolean;
}

export const NumericTableCellRenderer: FC<NumericTableCellRendererProps> = ({
  name,
  cohortData,
  hideNPct,
}) => {
  const { activeIndex, onClick } = useBarHoverStore();
  const [hover, setHover] = useState<{ index: number; x: number; top: number } | null>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement>>({});

  return (
    <>
      <div className={styles.statsGrid}>
        <div className={styles.statsHeaderRow}>
          <div className={styles.statsCohortCell} />
          {!hideNPct && <div className={styles.statsPctHeaderCell}>%</div>}
          {!hideNPct && <div className={styles.statsNHeaderCell}>N</div>}
          {STAT_KEYS.map((k) => (
            <div key={k} className={styles.statsHeaderCell}>{k}</div>
          ))}
        </div>
        {cohortData.map((cd, i) => {
          const row = cd.data.rows.find((r) => r.Name === name);
          if (!row) return null;
          const dimmed = activeIndex !== null && activeIndex !== i;
          return (
            <div
              key={cd.name}
              ref={(el) => { if (el) rowRefs.current[i] = el; }}
              className={styles.statsRow}
              onClick={() => onClick(i)}
              onMouseEnter={(e) => {
                const rect = rowRefs.current[i]?.getBoundingClientRect();
                if (rect) setHover({ index: i, x: e.clientX, top: rect.top });
              }}
              onMouseMove={(e) => {
                const rect = rowRefs.current[i]?.getBoundingClientRect();
                if (rect) setHover({ index: i, x: e.clientX, top: rect.top });
              }}
              onMouseLeave={() => setHover(null)}
              style={{ opacity: dimmed ? 0.25 : 1, cursor: 'pointer' }}
            >
              <div className={styles.statsCohortCell}>
                <span className={styles.statDot} style={{ backgroundColor: cd.color }} />
              </div>
              {!hideNPct && (
                <div className={styles.statsPctCell}>
                  {row.Pct != null ? `${Math.round(row.Pct * 10) / 10}` : '–'}
                </div>
              )}
              {!hideNPct && (
                <div className={styles.statsNCell}>
                  {row.N != null ? row.N.toLocaleString() : '–'}
                </div>
              )}
              {STAT_KEYS.map((k) => (
                <div key={k} className={styles.statsValueCell}>
                  {fmt(row[k] as number | null | undefined)}
                </div>
              ))}
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
    </>
  );
};
