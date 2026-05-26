import { FC, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { RowModal } from './RowModal';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { NumericChartFrame } from '../RowRenderers/NumericChartFrame';
import { KDEChartCellRenderer } from '../RowRenderers/KDEChartCellRenderer';
import { BoxPlotCellRenderer } from '../RowRenderers/BoxPlotCellRenderer';
import { NumericTableCellRenderer } from '../RowRenderers/NumericTableCellRenderer';
import { Tabs } from '../../../../components/ButtonsAndTabs/Tabs/Tabs';
import styles from './NumericGraphModal.module.css';

interface NumericGraphModalProps {
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  finalCohortSizes?: Record<string, number | null>;
  xMin: number;
  xMax: number;
  onClose: () => void;
  breadcrumbs?: string[];
}

export const NumericGraphModal: FC<NumericGraphModalProps> = ({
  name,
  cohortData,
  kdeData,
  finalCohortSizes,
  xMin,
  xMax,
  onClose,
  breadcrumbs,
}) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filteredCohortData = useFilteredCohortData(cohortData, visible);
  const [statMode, setStatMode] = useState<'coverage' | 'missingness'>('coverage');

  return (
    <RowModal onClose={onClose} breadcrumbs={breadcrumbs}>
      <div className={styles.container}>
        {/* <ModalLegend cohortData={cohortData} visible={visible} onToggle={toggle} /> */}

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

        <div className={styles.bottomRow}>
          <div className={styles.card}>
            <div className={styles.tableHeader}>
              <Tabs
                tabs={['Coverage', 'Missingness']}
                active_tab_index={statMode === 'coverage' ? 0 : 1}
                onTabChange={(i) => setStatMode(i === 0 ? 'coverage' : 'missingness')}
              />
            </div>
            <NumericTableCellRenderer name={name} cohortData={filteredCohortData} finalCohortSizes={finalCohortSizes} showBar statMode={statMode} />
          </div>
        </div>
      </div>
    </RowModal>
  );
};
