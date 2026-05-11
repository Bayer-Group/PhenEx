import { FC } from 'react';
import { type CohortClassified } from '../../types';
import { HoverOrDragPortal } from '../../../../components/Portal/HoverOrDragPortal';
import { BoxPlotCellRenderer } from './BoxPlotCellRenderer';
import styles from './BoxPlotModal.module.css';

const MODAL_CHART_W = 560;

interface BoxPlotModalProps {
  name: string;
  cohortData: CohortClassified[];
  xMin: number;
  xMax: number;
  x: number;
  y: number;
  /** Show only this cohort's box plot. */
  cohortIndex: number;
  onClose: () => void;
}

export const BoxPlotModal: FC<BoxPlotModalProps> = ({
  name,
  cohortData,
  xMin,
  xMax,
  x,
  y,
  cohortIndex,
  onClose,
}) => {
  return (
    <HoverOrDragPortal x={x} y={y} onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.title}>{name}</div>
        <BoxPlotCellRenderer
          name={name}
          cohortData={cohortData}
          xMin={xMin}
          xMax={xMax}
          width={MODAL_CHART_W}
          showGrid
          showLabels
          cohortIndex={cohortIndex}
        />
      </div>
    </HoverOrDragPortal>
  );
};
