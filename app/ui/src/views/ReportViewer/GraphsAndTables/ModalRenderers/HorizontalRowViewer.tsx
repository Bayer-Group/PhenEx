import { FC, useCallback, useMemo } from 'react';
import { type CohortClassified, type KdeCurve } from '../../types';
import { type SequentialRow } from '../../studyRegistryUtils';
import { RowModal } from './RowModal';
import { useCohortVisibility, useFilteredCohortData } from './ModalLegend';
import { BarChartCellRenderer } from '../RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from '../RowRenderers/CategoricalBarChartCellRenderer';
import { NumericChartFrame } from '../RowRenderers/NumericChartFrame';
import { KDEChartCellRenderer } from '../RowRenderers/KDEChartCellRenderer';
import { BoxPlotCellRenderer } from '../RowRenderers/BoxPlotCellRenderer';
import { NumericTableCellRenderer } from '../RowRenderers/NumericTableCellRenderer';
import numericStyles from './NumericGraphModal.module.css';
import booleanStyles from './BooleanRowModal.module.css';
import categoricalStyles from './CategoricalRowModal.module.css';

interface HorizontalRowViewerProps {
  rows: SequentialRow[];
  currentIndex: number;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const HorizontalRowViewer: FC<HorizontalRowViewerProps> = ({
  rows,
  currentIndex,
  cohortData,
  kdeData,
  onClose,
  onNavigate,
}) => {
  const current = rows[currentIndex];
  if (!current) return null;

  const breadcrumbs = [current.category, current.reporter, current.section, current.name]
    .filter(Boolean) as string[];

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < rows.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, rows.length, onNavigate]);

  return (
    <RowModal onClose={onClose} breadcrumbs={breadcrumbs} onPrev={currentIndex > 0 ? goPrev : undefined} onNext={currentIndex < rows.length - 1 ? goNext : undefined}>
      <RowContent
        row={current}
        cohortData={cohortData}
        kdeData={kdeData}
      />
    </RowModal>
  );
};

/* ── Content dispatcher ──────────────────────────────────────────────── */

const RowContent: FC<{
  row: SequentialRow;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}> = ({ row, cohortData, kdeData }) => {
  switch (row.rowType) {
    case 'boolean':
      return <BooleanContent name={row.name} cohortData={cohortData} />;
    case 'categorical':
      return <CategoricalContent baseName={row.name} cohortData={cohortData} />;
    case 'numeric':
      return <NumericContent name={row.name} cohortData={cohortData} kdeData={kdeData} />;
    default:
      return <div style={{ padding: 20, color: '#999' }}>No detail view for {row.rowType} rows yet.</div>;
  }
};

/* ── Boolean ─────────────────────────────────────────────────────────── */

const BooleanContent: FC<{ name: string; cohortData: CohortClassified[] }> = ({ name, cohortData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div className={booleanStyles.container}>
      <BarChartCellRenderer
        data={{ name, _meta: { cohortData: filtered } }}
        isModal
        pctDecimals={1}
      />
    </div>
  );
};

/* ── Categorical ─────────────────────────────────────────────────────── */

const CategoricalContent: FC<{ baseName: string; cohortData: CohortClassified[] }> = ({ baseName, cohortData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div className={categoricalStyles.container}>
      <CategoricalBarChartCellRenderer
        baseName={baseName}
        cohortData={filtered}
        orientation="vertical"
      />
    </div>
  );
};

/* ── Numeric ─────────────────────────────────────────────────────────── */

const NumericContent: FC<{
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}> = ({ name, cohortData, kdeData }) => {
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
    <div className={numericStyles.container}>
      <div className={numericStyles.distributionCard}>
        <NumericChartFrame xMin={xMin} xMax={xMax} showTicks>
          <div className={numericStyles.kdeSection}>
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
      <div className={numericStyles.bottomRow}>
        <div className={numericStyles.card}>
          <NumericTableCellRenderer name={name} cohortData={filtered} showBar />
        </div>
      </div>
    </div>
  );
};
