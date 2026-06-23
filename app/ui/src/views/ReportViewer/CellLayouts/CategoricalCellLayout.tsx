import { FC, useCallback } from 'react';
import { type IJsonModel } from 'flexlayout-react';
import { type CohortClassified } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { CategoricalBarChartCellRenderer } from '../GraphsAndTables/RowRenderers/CategoricalBarChartCellRenderer';
import { CommentsPanel } from '../CommentsPanel';
import { CellLayoutFrame } from './CellLayoutFrame';

interface CategoricalCellLayoutProps {
  row: SequentialRow;
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
}

const DEFAULT_JSON: IJsonModel = {
  global: { tabEnableClose: false, tabEnableRename: false, tabEnableDrag: true, tabSetEnableMaximize: false, tabSetEnableDrop: true },
  borders: [],
  layout: {
    type: 'row',
    children: [
      { type: 'tabset', weight: 25, children: [{ type: 'tab', name: 'Description', component: 'description' }] },
      { type: 'tabset', weight: 55, children: [{ type: 'tab', name: 'Chart', component: 'chart' }] },
      { type: 'tabset', weight: 20, children: [{ type: 'tab', name: 'Comments', component: 'comments' }] },
    ],
  },
};

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
  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'description':
          return <DescriptionPanel row={row} />;
        case 'chart':
          return <ChartPanel baseName={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        case 'comments':
          return <CommentsPanel row={row} />;
        default:
          return null;
      }
    },
    [row, cohortData, finalCohortSizes],
  );

  return (
    <CellLayoutFrame rowType="categorical" defaultJson={DEFAULT_JSON} factory={factory} />
  );
};
