import { FC, useState, useMemo, useCallback } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { HoverOrDragPortal } from '../../../components/Portal/HoverOrDragPortal';
import { NumericChartFrame } from './NumericChartFrame';
import { KDEChartCellRenderer } from './KDEChartCellRenderer';
import { BoxPlotCellRenderer } from './BoxPlotCellRenderer';
import styles from './NumericGraphModal.module.css';

const MODAL_CHART_W = 560;

interface NumericGraphModalProps {
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  xMin: number;
  xMax: number;
  x: number;
  y: number;
  onClose: () => void;
}

export const NumericGraphModal: FC<NumericGraphModalProps> = ({
  name,
  cohortData,
  kdeData,
  xMin,
  xMax,
  x,
  y,
  onClose,
}) => {
  // All cohorts visible by default
  const [visible, setVisible] = useState<Set<number>>(
    () => new Set(cohortData.map((_, i) => i)),
  );

  const toggleCohort = useCallback((i: number) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const filteredCohortData = useMemo(
    () => cohortData.filter((_, i) => visible.has(i)),
    [cohortData, visible],
  );

  return (
    <HoverOrDragPortal x={x} y={y} onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.title}>{name}</div>
          <div className={styles.legend}>
            {cohortData.map((cd, i) => (
              <button
                key={cd.name}
                className={`${styles.legendBtn} ${visible.has(i) ? '' : styles.legendBtnOff}`}
                style={{
                  '--cohort-color': cd.color,
                } as React.CSSProperties}
                onClick={() => toggleCohort(i)}
              >
                <span
                  className={styles.legendSwatch}
                  style={{ background: visible.has(i) ? cd.color : 'transparent' }}
                />
                {cd.name}
              </button>
            ))}
          </div>
        </div>
        <NumericChartFrame xMin={xMin} xMax={xMax} width={MODAL_CHART_W} showTicks>
          <div className={styles.kdeSection}>
            <KDEChartCellRenderer
              name={name}
              cohortData={filteredCohortData}
              kdeData={kdeData}
              xMin={xMin}
              xMax={xMax}
              width={MODAL_CHART_W}
              showTicks={false}
            />
          </div>
          <BoxPlotCellRenderer
            name={name}
            cohortData={filteredCohortData}
            xMin={xMin}
            xMax={xMax}
            width={MODAL_CHART_W}
            showLabels
          />
        </NumericChartFrame>
      </div>
    </HoverOrDragPortal>
  );
};
