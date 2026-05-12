import { FC, useMemo, useCallback, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { KDEChartCellRenderer } from './KDEChartCellRenderer';
import { BoxPlotCellRenderer } from './BoxPlotCellRenderer';
import { NumericGraphModal } from './NumericGraphModal';
import { useBarHoverStore } from './useBarHoverStore';
import styles from './NumericGraphCellRenderer.module.css';

interface NumericGraphCellRendererProps {
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}

export const NumericGraphCellRenderer: FC<NumericGraphCellRendererProps> = ({
  name,
  cohortData,
  kdeData,
}) => {
  const [modal, setModal] = useState<{ x: number; y: number } | null>(null);
  const { activeIndex } = useBarHoverStore();

  // Compute shared x range from row stats (Min/Max) only.
  // KDE curves extend beyond these but are clipped to [Min, Max].
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

  const handleClick = useCallback((e: React.MouseEvent) => {
    setModal({ x: e.clientX, y: e.clientY });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  return (
    <div className={styles.container} onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className={styles.kdeSection}>
        <KDEChartCellRenderer
          name={name}
          cohortData={cohortData}
          kdeData={kdeData}
          xMin={xMin}
          xMax={xMax}
        />
      </div>
      {activeIndex != null && (
        <div className={styles.boxPlotSection}>
          <BoxPlotCellRenderer
            name={name}
            cohortData={cohortData}
            xMin={xMin}
            xMax={xMax}
            cohortIndex={activeIndex}
          />
        </div>
      )}

      {modal && (
        <NumericGraphModal
          name={name}
          cohortData={cohortData}
          kdeData={kdeData}
          xMin={xMin}
          xMax={xMax}
          x={modal.x}
          y={modal.y}
          onClose={closeModal}
        />
      )}
    </div>
  );
};
