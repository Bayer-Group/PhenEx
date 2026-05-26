import { FC, useMemo, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { NumericChartFrame } from '../RowRenderers/NumericChartFrame';
import { KDEChartCellRenderer } from '../RowRenderers/KDEChartCellRenderer';
import { BoxPlotCellRenderer } from '../RowRenderers/BoxPlotCellRenderer';
import { NumericTableCellRenderer } from '../RowRenderers/NumericTableCellRenderer';
import { Tabs } from '../../../../components/ButtonsAndTabs/Tabs/Tabs';
import styles from './NumericContent.module.css';

interface NumericContentProps {
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  finalCohortSizes?: Record<string, number | null>;
}

export const NumericContent: FC<NumericContentProps> = ({ name, cohortData, kdeData, finalCohortSizes }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);
  const [statMode, setStatMode] = useState<'coverage' | 'missingness'>('coverage');

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
          <div className={styles.tableHeader}>
            <Tabs
              tabs={['Coverage', 'Missingness']}
              active_tab_index={statMode === 'coverage' ? 0 : 1}
              onTabChange={(i) => setStatMode(i === 0 ? 'coverage' : 'missingness')}
            />
          </div>
          <NumericTableCellRenderer name={name} cohortData={filtered} finalCohortSizes={finalCohortSizes} showBar statMode={statMode} />
        </div>
      </div>
    </div>
  );
};
