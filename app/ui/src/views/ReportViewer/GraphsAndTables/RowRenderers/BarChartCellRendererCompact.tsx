import { FC, useState, useRef, useCallback } from 'react';
import { BooleanRowModal } from '../ModalRenderers/BooleanRowModal';
import { usePanZoomScale } from '../../../../hooks/PanZoomScaleContext';
import { CohortNameTooltip } from './CohortNameTooltip';
import {
  type BarChartBaseProps,
  type RenderRow,
  buildFlatRows,
  COMPACT_GRID_LINES,
  getCohortRowValues,
} from './barChartShared';
import { BarChartGridOverlay, BarChartHeader } from './barChartParts';
import styles from './BarChartCellRenderer.module.css';

export const BarChartCellRendererCompact: FC<BarChartBaseProps> = ({
  data,
  isModal,
  breadcrumbs,
  pctDecimals = 0,
  hideHeader = false,
}) => {
  const { cohortData, finalCohortSizes = {} } = data._meta;
  const { name } = data;
  const [hover, setHover] = useState<{ index: number; x: number; top: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const barRefs = useRef<Record<number, HTMLDivElement>>({});

  const openModal = useCallback(() => { if (!isModal) setModalOpen(true); }, [isModal]);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const scale = usePanZoomScale();
  const hideLabels = scale < 0.5;
  const flatRows = buildFlatRows(cohortData);

  const renderRow = (entry: RenderRow) => {
    const { pct, n } = getCohortRowValues(entry, name, finalCohortSizes);
    const barPct = Math.max(0, pct);

    return (
      <div
        key={entry.cohort.name}
        ref={(el) => { if (el) barRefs.current[entry.originalIndex] = el; }}
        className={styles.cohortRow}
        onClick={openModal}
        onMouseEnter={(e) => {
          const rect = barRefs.current[entry.originalIndex]?.getBoundingClientRect();
          if (rect) setHover({ index: entry.originalIndex, x: e.clientX, top: rect.top });
        }}
        onMouseMove={(e) => {
          const rect = barRefs.current[entry.originalIndex]?.getBoundingClientRect();
          if (rect) setHover({ index: entry.originalIndex, x: e.clientX, top: rect.top });
        }}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'pointer' }}
      >
        <div className={`${styles.dataCells} ${styles.dataCellsCompact}`}>
          <div className={styles.barCellCompact}>
            <div
              className={styles.barFill}
              style={{ width: `${barPct}%`, backgroundColor: entry.cohort.color }}
            />
            {!hideLabels && (
              <span
                className={styles.barEndLabel}
                style={{ left: `calc(${barPct}% + var(--BOOLEAN_BAR_LABEL_GAP, 6px))` }}
              >
                <strong>{pct.toFixed(pctDecimals)}%</strong> ({n.toLocaleString()})
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles.container}
      style={{ '--cohort-count': cohortData.length } as React.CSSProperties}
    >
      <BarChartHeader compact hidden={hideHeader} />
      <BarChartGridOverlay lines={COMPACT_GRID_LINES} compact />
      <div className={styles.rows}>
        {flatRows.map(renderRow)}
      </div>

      {hover && (
        <CohortNameTooltip
          name={cohortData[hover.index]?.displayName ?? cohortData[hover.index]?.name ?? ''}
          x={hover.x}
          top={hover.top}
        />
      )}

      {modalOpen && (
        <BooleanRowModal
          name={name}
          cohortData={cohortData}
          onClose={closeModal}
          breadcrumbs={breadcrumbs}
        />
      )}
    </div>
  );
};
