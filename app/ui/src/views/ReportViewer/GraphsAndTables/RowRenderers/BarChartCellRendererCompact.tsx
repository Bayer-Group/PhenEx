import { FC, useState, useRef, useCallback } from 'react';
import { BooleanRowModal } from '../ModalRenderers/BooleanRowModal';
import { usePanZoomScale } from '../../../../hooks/PanZoomScaleContext';
import { CohortNameTooltip } from './CohortNameTooltip';
import {
  type BarChartBaseProps,
  type RenderRow,
  buildFlatItems,
  COMPACT_GRID_LINES,
  getCohortRowValues,
  SPACER_UNIT_PX,
} from './barChartShared';
import { BarChartGridOverlay, BarChartHeader } from './barChartParts';
import styles from './BarChartCellRenderer.module.css';

export const BarChartCellRendererCompact: FC<BarChartBaseProps> = ({
  data,
  isModal,
  breadcrumbs,
  pctDecimals = 0,
  hideHeader = false,
  spacerUnitPx = SPACER_UNIT_PX,
}) => {
  const { cohortData, finalCohortSizes = {}, spacers = [] } = data._meta;
  const { name } = data;
  const [hover, setHover] = useState<{ index: number; x: number; top: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const barRefs = useRef<Record<number, HTMLDivElement>>({});

  const openModal = useCallback(() => { if (!isModal) setModalOpen(true); }, [isModal]);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const scale = usePanZoomScale();
  const hideLabels = scale < 0.5;
  const flatItems = buildFlatItems(cohortData, spacers);

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
        <div className={styles.barRowCompact}>
          <div className={styles.barTrackCompact}>
            <div
              className={styles.barFillCompact}
              style={{ width: `${barPct}%`, backgroundColor: entry.cohort.color }}
            />
          </div>
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
    );
  };

  return (
    <div
      className={`${styles.container} ${styles.containerCompact}`}
      style={{ '--cohort-count': cohortData.length } as React.CSSProperties}
    >
      <BarChartHeader compact hidden={hideHeader} />
      <div className={styles.compactChartBody}>
        <BarChartGridOverlay lines={COMPACT_GRID_LINES} compact />
        <div className={styles.rows}>
          {flatItems.map((item) =>
            item.type === 'spacer' ? (
              <div
                key={item.key}
                className={styles.barSpacer}
                style={{ height: item.size * spacerUnitPx }}
                aria-hidden={!item.label}
              >
                {item.label && <span className={styles.barSpacerLabel}>{item.label}</span>}
              </div>
            ) : (
              renderRow(item.row)
            ),
          )}
        </div>
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
          spacers={spacers}
        />
      )}
    </div>
  );
};
