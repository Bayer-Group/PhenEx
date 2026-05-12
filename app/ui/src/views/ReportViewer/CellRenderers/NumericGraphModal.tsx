import { FC } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { RowModal } from './RowModal';
import { ModalLegend, useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { NumericChartFrame } from './NumericChartFrame';
import { KDEChartCellRenderer } from './KDEChartCellRenderer';
import { BoxPlotCellRenderer } from './BoxPlotCellRenderer';
import { NumericTableCellRenderer } from './NumericTableCellRenderer';
import { BarChartCellRenderer } from './BarChartCellRenderer';
import styles from './NumericGraphModal.module.css';

interface NumericGraphModalProps {
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  xMin: number;
  xMax: number;
  onClose: () => void;
  breadcrumbs?: string[];
}

export const NumericGraphModal: FC<NumericGraphModalProps> = ({
  name,
  cohortData,
  kdeData,
  xMin,
  xMax,
  onClose,
  breadcrumbs,
}) => {
  const { visible, toggle } = useCohortVisibility(cohortData.length);
  const filteredCohortData = useFilteredCohortData(cohortData, visible);

  return (
    <RowModal onClose={onClose} breadcrumbs={breadcrumbs}>
      <div className={styles.container}>
        <ModalLegend cohortData={cohortData} visible={visible} onToggle={toggle} />

        <div className={styles.topRow}>
          <div className={styles.distributionCard}>
            <NumericChartFrame xMin={xMin} xMax={xMax} showTicks>
              <div className={styles.kdeSection}>
                <KDEChartCellRenderer
                  name={name}
                  cohortData={filteredCohortData}
                  kdeData={kdeData}
                  xMin={xMin}
                  xMax={xMax}
                  showTicks={false}
                />
              </div>
              <BoxPlotCellRenderer
                name={name}
                cohortData={filteredCohortData}
                xMin={xMin}
                xMax={xMax}
                showLabels
              />
            </NumericChartFrame>
          </div>

          <div className={styles.card}>
            <BarChartCellRenderer
              data={{ name, _meta: { cohortData: filteredCohortData } }}
              isModal
            />
          </div>
        </div>

        <div className={styles.card}>
          <NumericTableCellRenderer name={name} cohortData={filteredCohortData} />
        </div>
      </div>
    </RowModal>
  );
};
