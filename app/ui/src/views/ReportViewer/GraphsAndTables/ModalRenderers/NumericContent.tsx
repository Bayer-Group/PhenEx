import { FC, useMemo } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { NumericChartFrame } from '../RowRenderers/NumericChartFrame';
import { KDEChartCellRenderer } from '../RowRenderers/KDEChartCellRenderer';
import { BoxPlotCellRenderer } from '../RowRenderers/BoxPlotCellRenderer';
import { NumericTableCellRenderer } from '../RowRenderers/NumericTableCellRenderer';
import styles from './NumericContent.module.css';

interface NumericContentProps {
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}

export const NumericContent: FC<NumericContentProps> = ({ name, cohortData, kdeData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  const { xMin, xMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const cd of cohortData) {
      const row = cd.data.rows.find((r) => r.Name === name);
      if (!row) continue;
      if (row.Min != null && row.Min < lo) lo = row.Min;
      if (row.Max != null && row.Max > hi) hi = row.Max;
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    return { xMin: lo, xMax: hi };
  }, [name, cohortData]);

  return (
    <div className={styles.container}>
      <div className={styles.distributionCard}>
        <NumericChartFrame xMin={xMin} xMax={xMax} showTicks>
          <div className={styles.kdeSection}>
            <KDEChartCellRenderer
              name={name}
              cohortData={filtered}
              kdeData={kdeData}
              xMin={xMin}
              xMax={xMax}
              showTicks={false}
            />
          </div>
          <BoxPlotCellRenderer
            name={name}
            cohortData={filtered}
            xMin={xMin}
            xMax={xMax}
            showLabels
          />
        </NumericChartFrame>
      </div>
      <div className={styles.bottomRow}>
        <div className={styles.card}>
          <NumericTableCellRenderer name={name} cohortData={filtered} showBar />
        </div>
      </div>
    </div>
  );
};
