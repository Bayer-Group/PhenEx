import { FC, useEffect } from 'react';
import { useBarHoverStore } from './useBarHoverStore';
import {
  type BarChartBaseProps,
  type RenderGroup,
  type RenderRow,
  type RenderRowOptions,
  buildGroupedRows,
  DEFAULT_TICKS,
  getCohortRowValues,
  withHundredTick,
} from './barChartShared';
import { BarChartGridOverlay, BarChartHeader } from './barChartParts';
import styles from './BarChartCellRenderer.module.css';

export const BarChartCellRendererPresentation: FC<BarChartBaseProps> = ({
  data,
  pctDecimals = 0,
}) => {
  const { cohortData, ticks = DEFAULT_TICKS, finalCohortSizes = {} } = data._meta;
  const { name } = data;
  const { activeIndex, onHover } = useBarHoverStore();
  const gridLines = withHundredTick(ticks);
  const groupedRows = buildGroupedRows(cohortData);

  useEffect(() => {
    if (activeIndex === null) return;
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      const onScroll = () => onHover(null);
      window.addEventListener('scroll', onScroll, true);
      cleanup = () => window.removeEventListener('scroll', onScroll, true);
    }, 500);
    return () => { clearTimeout(timer); cleanup?.(); };
  }, [activeIndex, onHover]);

  const renderRow = (entry: RenderRow, options?: RenderRowOptions) => {
    const { pct, n, finalCohortSize } = getCohortRowValues(entry, name, finalCohortSizes);
    const dimmed = activeIndex !== null && activeIndex !== entry.originalIndex;
    const label = options?.label ?? entry.label;
    const labelClassName = options?.labelClassName ?? '';

    return (
      <div
        key={entry.cohort.name}
        className={`${styles.cohortRow} ${styles.cohortRowPresentation}`}
        onClick={(e) => {
          e.stopPropagation();
          onHover(activeIndex === entry.originalIndex ? null : entry.originalIndex);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div
          className={`${styles.cohortLabelCell} ${labelClassName}`.trim()}
          style={options?.labelStyle}
        >
          {label}
        </div>
        <div className={styles.dataCells}>
          <div className={styles.barCell} style={{ opacity: dimmed ? 0.25 : 1 }}>
            <div
              className={styles.barFill}
              style={{ width: `${Math.max(0, pct)}%`, backgroundColor: entry.cohort.color }}
            />
          </div>
          <div className={styles.pctCell}>
            <strong>{pct.toFixed(pctDecimals)}</strong>
          </div>
          <div
            className={styles.nCell}
            style={{ opacity: dimmed ? 0.25 : 1, color: activeIndex === entry.originalIndex ? '#000' : undefined }}
          >
            {finalCohortSize != null ? (
              <>
                <span className={styles.nValuePrimary}>{n.toLocaleString()}</span>
                <span className={styles.nValueSlash}>/</span>
                <span className={styles.nValueSecondary}>{finalCohortSize.toLocaleString()}</span>
              </>
            ) : (
              n.toLocaleString()
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPresentationGroup = (group: RenderGroup) => {
    const mainRow = group.mainRow;
    const hasSubrows = group.rows.length > 0;

    return (
      <div key={group.name} className={styles.groupSection}>
        <div className={styles.groupRows}>
          <BarChartGridOverlay lines={gridLines} presentation />

          {mainRow ? (
            renderRow(mainRow, {
              label: group.displayName,
              labelClassName: styles.parentCohortLabelCell,
              labelStyle: { backgroundColor: group.color },
            })
          ) : (
            <div className={styles.groupTitleStandalone} style={{ backgroundColor: group.color }}>
              {group.displayName}
            </div>
          )}

          {hasSubrows && group.rows.map((entry) => renderRow(entry))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`${styles.container} ${styles.containerPresentation}`}
      style={{ '--cohort-count': cohortData.length } as React.CSSProperties}
    >
      {activeIndex !== null && (
        <div className={styles.dismissOverlay} onClick={(e) => { e.stopPropagation(); onHover(null); }} />
      )}

      <BarChartHeader presentation />
      <div className={styles.rows}>
        {groupedRows.map(renderPresentationGroup)}
      </div>
    </div>
  );
};
