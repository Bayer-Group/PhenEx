import { FC } from 'react';
import styles from './BarChartCellRenderer.module.css';
import { HEADER_TICKS } from './barChartShared';

interface BarChartHeaderProps {
  presentation?: boolean;
}

export const BarChartHeader: FC<BarChartHeaderProps> = ({ presentation = false }) => (
  <div className={`${styles.headerRow} ${presentation ? styles.headerRowPresentation : ''}`}>
    {presentation && <div className={styles.headerCohort}>Cohort</div>}
    <div className={styles.headerBar}>
      {HEADER_TICKS.map((t) => (
        <span key={t} className={styles.headerTick} style={{ left: `${t}%` }}>{t}</span>
      ))}
    </div>
    <div className={styles.headerPct}>%</div>
    <div className={styles.headerN}>N</div>
  </div>
);

interface BarChartGridOverlayProps {
  lines: number[];
  presentation?: boolean;
}

export const BarChartGridOverlay: FC<BarChartGridOverlayProps> = ({ lines, presentation = false }) => (
  <div className={`${styles.gridOverlay} ${presentation ? styles.gridOverlayPresentation : ''}`}>
    {lines.map((t) => (
      <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
    ))}
  </div>
);
