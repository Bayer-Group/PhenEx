import { FC, useCallback, useMemo } from 'react';
import { type IJsonModel } from 'flexlayout-react';
import { type CohortClassified, type KdeCurve } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { NumericChartFrame } from '../GraphsAndTables/RowRenderers/NumericChartFrame';
import { KDEChartCellRenderer } from '../GraphsAndTables/RowRenderers/KDEChartCellRenderer';
import { BoxPlotCellRenderer } from '../GraphsAndTables/RowRenderers/BoxPlotCellRenderer';
import { NumericTableCellRenderer } from '../GraphsAndTables/RowRenderers/NumericTableCellRenderer';
import { DescriptionPanel } from './DescriptionPanel';
import { CommentsPanel } from '../CommentsPanel';
import { CellLayoutFrame } from './CellLayoutFrame';

interface NumericCellLayoutProps {
  row: SequentialRow;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  finalCohortSizes?: Record<string, number | null>;
}

const DEFAULT_JSON: IJsonModel = {
  global: { tabEnableClose: false, tabEnableRename: false, tabEnableDrag: true, tabSetEnableMaximize: true, tabSetEnableDrop: true },
  borders: [],
  layout: {
    type: 'row',
    children: [
      {
        type: 'row',
        weight: 80,
        children: [
          {
            type: 'row',
            children: [
              {
                type: 'row',
                children: [
                  { type: 'tabset', weight: 25, children: [{ type: 'tab', name: 'Description', component: 'description' }] },
                  { type: 'tabset', weight: 25, children: [{ type: 'tab', name: 'Distribution', component: 'distribution' }] },
                ],
              },
              { type: 'tabset', weight: 25, children: [{ type: 'tab', name: 'Box Plots', component: 'boxplot' }] },
            ],
          },
          {
            type: 'row',
            children: [
              { type: 'tabset', weight: 25, children: [{ type: 'tab', name: 'Summary Statistics', component: 'summary' }] },
            ],
          },
        ],
      },
      { type: 'tabset', weight: 20, children: [{ type: 'tab', name: 'Comments', component: 'comments' }] },
    ],
  },
};

const CoveragePanel: FC<{ name: string; cohortData: CohortClassified[]; finalCohortSizes?: Record<string, number | null> }> = ({ name, cohortData, finalCohortSizes }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);
  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <NumericTableCellRenderer name={name} cohortData={filtered} finalCohortSizes={finalCohortSizes} showBar hideStats statMode="coverage" />
    </div>
  );
};

const MissingnessPanel: FC<{ name: string; cohortData: CohortClassified[]; finalCohortSizes?: Record<string, number | null> }> = ({ name, cohortData, finalCohortSizes }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);
  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <NumericTableCellRenderer name={name} cohortData={filtered} finalCohortSizes={finalCohortSizes} showBar hideStats statMode="missingness" />
    </div>
  );
};

const SummaryStatsPanel: FC<{ name: string; cohortData: CohortClassified[] }> = ({ name, cohortData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);
  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <NumericTableCellRenderer name={name} cohortData={filtered} />
    </div>
  );
};

const DistributionPanel: FC<{ name: string; cohortData: CohortClassified[]; kdeData: Record<string, Record<string, KdeCurve>> }> = ({ name, cohortData, kdeData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  const { xMin, xMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const cd of cohortData) {
      const r = cd.data.rows.find((r) => r.Name === name);
      if (!r) continue;
      if (r.Min != null && r.Min < lo) lo = r.Min;
      if (r.Max != null && r.Max > hi) hi = r.Max;
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    return { xMin: lo, xMax: hi };
  }, [name, cohortData]);

  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box' }}>
      <NumericChartFrame xMin={xMin} xMax={xMax} showTicks>
        <KDEChartCellRenderer name={name} cohortData={filtered} kdeData={kdeData} xMin={xMin} xMax={xMax} showTicks={false} />
      </NumericChartFrame>
    </div>
  );
};

const BoxplotPanel: FC<{ name: string; cohortData: CohortClassified[]; kdeData: Record<string, Record<string, KdeCurve>> }> = ({ name, cohortData, kdeData }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  const { xMin, xMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const cd of cohortData) {
      const r = cd.data.rows.find((r) => r.Name === name);
      if (!r) continue;
      if (r.Min != null && r.Min < lo) lo = r.Min;
      if (r.Max != null && r.Max > hi) hi = r.Max;
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    return { xMin: lo, xMax: hi };
  }, [name, cohortData]);

  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box' }}>
      <NumericChartFrame xMin={xMin} xMax={xMax} showTicks>
        <BoxPlotCellRenderer name={name} cohortData={filtered} xMin={xMin} xMax={xMax} showLabels />
      </NumericChartFrame>
    </div>
  );
};


export const NumericCellLayout: FC<NumericCellLayoutProps> = ({ row, cohortData, kdeData, finalCohortSizes }) => {
  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'description':
          return <DescriptionPanel row={row} />;
        case 'coverage':
          return <CoveragePanel name={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        case 'missingness':
          return <MissingnessPanel name={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        case 'summary':
          return <SummaryStatsPanel name={row.name} cohortData={cohortData} />;
        case 'distribution':
          return <DistributionPanel name={row.name} cohortData={cohortData} kdeData={kdeData} />;
        case 'boxplot':
          return <BoxplotPanel name={row.name} cohortData={cohortData} kdeData={kdeData} />;
        case 'comments':
          return <CommentsPanel row={row} />;
        default:
          return null;
      }
    },
    [row, cohortData, kdeData, finalCohortSizes],
  );

  return (
    <CellLayoutFrame rowType="numeric" defaultJson={DEFAULT_JSON} factory={factory} />
  );
};
