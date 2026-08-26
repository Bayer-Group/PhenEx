import { FC, useState, useRef, useCallback } from 'react';
import { BooleanRowModal } from '../ModalRenderers/BooleanRowModal';
import { usePanZoomScale } from '../../../../hooks/PanZoomScaleContext';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
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
import { useGridItemCols } from '../../SectionLayouts/GridItemContext';
import styles from './BarChartCellRenderer.module.css';

export const BarChartCellRendererCompact: FC<BarChartBaseProps> = ({
  data,
  isModal,
  breadcrumbs,
  pctDecimals = 0,
  hideHeader = false,
  spacerUnitPx = SPACER_UNIT_PX,
  fillHeight = false,
}) => {
  const { cohortData, finalCohortSizes = {}, spacers = [] } = data._meta;
  const { name } = data;
  const [hover, setHover] = useState<{ index: number; x: number; top: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const barRefs = useRef<Record<number, HTMLDivElement>>({});
  const bodyRef = useRef<HTMLDivElement>(null);

  const openModal = useCallback(() => { if (!isModal) setModalOpen(true); }, [isModal]);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const scale = usePanZoomScale();
  const cols = useGridItemCols();
  const narrow = cols < 2;
  const hideLabels = scale < 0.5;
  const hideN = narrow;
  const flatItems = buildFlatItems(cohortData, spacers);

  // Reserve right padding only when bars are long enough that end-labels would overflow.
  const maxPct = flatItems.reduce((max, item) =>
    item.type === 'row' ? Math.max(max, getCohortRowValues(item.row, name, finalCohortSizes).pct) : max, 0);
  const fillLabelSpace = narrow ? '15px' : maxPct > 80 ? '100px' : '15px';

  const renderRow = (entry: RenderRow) => {
    const { pct, n } = getCohortRowValues(entry, name, finalCohortSizes);
    const barPct = Math.max(0, pct);

    const hoverHandlers = {
      onMouseEnter: (e: React.MouseEvent) => {
        const rect = barRefs.current[entry.originalIndex]?.getBoundingClientRect();
        if (rect) setHover({ index: entry.originalIndex, x: e.clientX, top: rect.top });
      },
      onMouseMove: (e: React.MouseEvent) => {
        const rect = barRefs.current[entry.originalIndex]?.getBoundingClientRect();
        if (rect) setHover({ index: entry.originalIndex, x: e.clientX, top: rect.top });
      },
      onMouseLeave: () => setHover(null),
    };

    return (
      <div
        key={entry.cohort.name}
        ref={(el) => { if (el) barRefs.current[entry.originalIndex] = el; }}
        className={styles.cohortRow}
        onClick={openModal}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.barRowCompact}>
          <div className={styles.barTrackCompact}>
            <div
              className={styles.barFillCompact}
              style={{ width: `${barPct}%`, backgroundColor: entry.cohort.color }}
              {...hoverHandlers}
            />
          </div>
          {!hideLabels && (
            <span
              className={styles.barEndLabel}
              style={{ left: `calc(${barPct}% + var(--BOOLEAN_BAR_LABEL_GAP, 6px))` }}
              {...hoverHandlers}
            >
              <strong>{pct.toFixed(pctDecimals)}%</strong>{!hideN && ` (${n.toLocaleString()})`}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={[
        styles.container,
        styles.containerCompact,
        hideHeader && styles.containerCompactNoHeader,
        fillHeight && styles.containerFillHeight,
      ].filter(Boolean).join(' ')}
      style={{ '--cohort-count': cohortData.length, ...(fillHeight ? { '--fill-label-space': fillLabelSpace } : {}) } as React.CSSProperties}
    >
      {!hideHeader && <BarChartHeader compact />}
      <div ref={bodyRef} className={styles.compactChartBody}>
        <BarChartGridOverlay lines={COMPACT_GRID_LINES} compact />
        <div className={styles.rows}>
          {flatItems.map((item) =>
            item.type === 'spacer' ? (
              <div
                key={item.key}
                className={styles.barSpacer}
                style={{ height: 10 + (item.size - 1) * spacerUnitPx }}
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

      {fillHeight && (
        <SimpleCustomScrollbar
          targetRef={bodyRef}
          orientation="vertical"
          marginTop={hideHeader ? 0 : 'var(--BOOLEAN_COMPACT_HEADER_HEIGHT)'}
          marginBottom={10}
          classNameTrack={styles.fillScrollBarTrack}
          classNameThumb={styles.fillScrollBarThumb}
          showOnHover
        />
      )}

      {hover && (
        <CohortNameTooltip
          cohortData={cohortData}
          index={hover.index}
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
