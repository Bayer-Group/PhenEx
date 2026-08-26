import { FC } from 'react';
import styles from './BarChartCellRenderer.module.css';
import { HEADER_TICKS } from './barChartShared';

interface BarChartHeaderProps {
  presentation?: boolean;
  compact?: boolean;
  /** Keep header layout space but hide labels (stacked compact charts). */
  hidden?: boolean;
}

export const BarChartHeader: FC<BarChartHeaderProps> = ({
  presentation = false,
  compact = false,
  hidden = false,
}) => (
  <div
    className={[
      styles.headerRow,
      presentation && styles.headerRowPresentation,
      compact && styles.headerRowCompact,
      hidden && styles.headerRowHidden,
    ].filter(Boolean).join(' ')}
  >
    {presentation && <div className={styles.headerCohort}>Cohort</div>}
    <div className={styles.headerBar}>
      {HEADER_TICKS.map((t) => (
        <span key={t} className={styles.headerTick} style={{ left: `${t}%` }}>{t}</span>
      ))}
    </div>
    {!compact && (
      <>
        <div className={styles.headerPct}>%</div>
        <div className={styles.headerN}>N</div>
      </>
    )}
  </div>
);

interface BarChartGridOverlayProps {
  lines: number[];
  presentation?: boolean;
  compact?: boolean;
}

export const BarChartGridOverlay: FC<BarChartGridOverlayProps> = ({
  lines,
  presentation = false,
  compact = false,
}) => (
  <div
    className={[
      styles.gridOverlay,
      presentation && styles.gridOverlayPresentation,
      compact && styles.gridOverlayCompact,
    ].filter(Boolean).join(' ')}
  >
    {lines.map((t) => (
      <div key={t} className={styles.gridLine} style={{ left: `${t}%` }} />
    ))}
  </div>
);
