import { FC, useCallback, useMemo, useState } from 'react';
import { Layout, Model, IJsonModel } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import { type CohortClassified, type KdeCurve } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { NumericChartFrame } from '../GraphsAndTables/RowRenderers/NumericChartFrame';
import { KDEChartCellRenderer } from '../GraphsAndTables/RowRenderers/KDEChartCellRenderer';
import { BoxPlotCellRenderer } from '../GraphsAndTables/RowRenderers/BoxPlotCellRenderer';
import { NumericTableCellRenderer } from '../GraphsAndTables/RowRenderers/NumericTableCellRenderer';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';

interface NumericCellLayoutProps {
  row: SequentialRow;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  finalCohortSizes?: Record<string, number | null>;
}

const DescriptionPanel: FC<{ row: SequentialRow }> = ({ row }) => (
  <div style={{ padding: 16, fontFamily: '"IBMPlexSans-regular", sans-serif', fontSize: 14, color: '#333' }}>
    <p style={{ margin: 0 }}>{row.registry?.description || 'No description available.'}</p>
  </div>
);

const DistributionPanel: FC<{ name: string; cohortData: CohortClassified[]; kdeData: Record<string, Record<string, KdeCurve>> }> = ({ name, cohortData, kdeData }) => {
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
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box' }}>
      <NumericChartFrame xMin={xMin} xMax={xMax} showTicks>
        <KDEChartCellRenderer
          name={name}
          cohortData={filtered}
          kdeData={kdeData}
          xMin={xMin}
          xMax={xMax}
          showTicks={false}
        />
        <BoxPlotCellRenderer
          name={name}
          cohortData={filtered}
          xMin={xMin}
          xMax={xMax}
          showLabels
        />
      </NumericChartFrame>
    </div>
  );
};

const MissingnessPanel: FC<{ name: string; cohortData: CohortClassified[]; finalCohortSizes?: Record<string, number | null> }> = ({ name, cohortData, finalCohortSizes }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);
  const [statMode, setStatMode] = useState<'coverage' | 'missingness'>('coverage');

  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <Tabs
        tabs={['Coverage', 'Missingness']}
        active_tab_index={statMode === 'coverage' ? 0 : 1}
        onTabChange={(i) => setStatMode(i === 0 ? 'coverage' : 'missingness')}
      />
      <NumericTableCellRenderer name={name} cohortData={filtered} finalCohortSizes={finalCohortSizes} showBar statMode={statMode} />
    </div>
  );
};

export const NumericCellLayout: FC<NumericCellLayoutProps> = ({ row, cohortData, kdeData, finalCohortSizes }) => {
  const model = useMemo(() => {
    const json: IJsonModel = {
      global: { tabEnableClose: false, tabEnableRename: false, tabEnableDrag: false, tabSetEnableMaximize: false, tabSetEnableDrop: false },
      borders: [],
      layout: {
        type: 'row',
        children: [
          {
            type: 'row',
            children: [
              {
                type: 'tabset',
                weight: 20,
                enableTabStrip: false,
                children: [{ type: 'tab', name: 'Description', component: 'description' }],
              },
              {
                type: 'tabset',
                weight: 50,
                enableTabStrip: false,
                children: [{ type: 'tab', name: 'Distribution', component: 'distribution' }],
              },
              {
                type: 'tabset',
                weight: 30,
                enableTabStrip: false,
                children: [{ type: 'tab', name: 'Missingness', component: 'missingness' }],
              },
            ],
          },
        ],
      },
    };
    return Model.fromJson(json);
  }, []);

  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'description':
          return <DescriptionPanel row={row} />;
        case 'distribution':
          return <DistributionPanel name={row.name} cohortData={cohortData} kdeData={kdeData} />;
        case 'missingness':
          return <MissingnessPanel name={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        default:
          return null;
      }
    },
    [row, cohortData, kdeData, finalCohortSizes],
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Layout model={model} factory={factory} />
    </div>
  );
};
