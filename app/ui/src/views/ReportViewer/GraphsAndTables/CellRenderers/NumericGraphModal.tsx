import { FC } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { HoverOrDragPortal } from '../../../../components/Portal/HoverOrDragPortal';
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
  return (
    <HoverOrDragPortal x={x} y={y} onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.title}>{name}</div>
        <div className={styles.kdeSection}>
          <KDEChartCellRenderer
            name={name}
            cohortData={cohortData}
            kdeData={kdeData}
            xMin={xMin}
            xMax={xMax}
            width={MODAL_CHART_W}
          />
        </div>
        <div className={styles.boxPlotSection}>
          <BoxPlotCellRenderer
            name={name}
            cohortData={cohortData}
            xMin={xMin}
            xMax={xMax}
            width={MODAL_CHART_W}
          />
        </div>
      </div>
    </HoverOrDragPortal>
  );
};
