import { FC, useCallback, useMemo } from 'react';
import { Layout, Model, IJsonModel } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import { type CohortClassified } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { CategoricalBarChartCellRenderer } from '../GraphsAndTables/RowRenderers/CategoricalBarChartCellRenderer';

interface CategoricalCellLayoutProps {
  row: SequentialRow;
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
}

const DescriptionPanel: FC<{ row: SequentialRow }> = ({ row }) => (
  <div style={{ padding: 16, fontFamily: '"IBMPlexSans-regular", sans-serif', fontSize: 14, color: '#333' }}>
    <p style={{ margin: 0 }}>{row.registry?.description || 'No description available.'}</p>
  </div>
);

const ChartPanel: FC<{ baseName: string; cohortData: CohortClassified[]; finalCohortSizes?: Record<string, number | null> }> = ({ baseName, cohortData, finalCohortSizes }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <CategoricalBarChartCellRenderer
        baseName={baseName}
        cohortData={filtered}
        finalCohortSizes={finalCohortSizes}
        orientation="vertical"
      />
    </div>
  );
};

export const CategoricalCellLayout: FC<CategoricalCellLayoutProps> = ({ row, cohortData, finalCohortSizes }) => {
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
                weight: 25,
                enableTabStrip: false,
                children: [{ type: 'tab', name: 'Description', component: 'description' }],
              },
              {
                type: 'tabset',
                weight: 75,
                enableTabStrip: false,
                children: [{ type: 'tab', name: 'Chart', component: 'chart' }],
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
        case 'chart':
          return <ChartPanel baseName={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        default:
          return null;
      }
    },
    [row, cohortData, finalCohortSizes],
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <Layout model={model} factory={factory} />
    </div>
  );
};
