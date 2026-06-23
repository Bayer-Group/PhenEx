import { FC, useCallback, useMemo } from 'react';
import { type IJsonModel } from 'flexlayout-react';
import { type CohortClassified } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { DescriptionPanel } from './DescriptionPanel';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { BarChartCellRenderer } from '../GraphsAndTables/RowRenderers/BarChartCellRenderer';
import { CommentsPanel } from '../CommentsPanel';
import { CellLayoutFrame } from './CellLayoutFrame';

interface BooleanCellLayoutProps {
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
      {
        type: 'row',
        weight: 30,
        children: [
          { type: 'tabset', weight: 30, children: [{ type: 'tab', name: 'Description', component: 'description' }] },
        ],
      },
      { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Visualization', component: 'visualization' }] },
      { type: 'tabset', weight: 20, children: [{ type: 'tab', name: 'Comments', component: 'comments' }] },
    ],
  },
};


const VisualizationPanel: FC<{ name: string; cohortData: CohortClassified[]; finalCohortSizes?: Record<string, number | null> }> = ({ name, cohortData, finalCohortSizes }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box' }}>
      <BarChartCellRenderer
        data={{ name, _meta: { cohortData: filtered, finalCohortSizes } }}
        isModal
        mode="presentation"
        pctDecimals={1}
      />
    </div>
  );
};

export const BooleanCellLayout: FC<BooleanCellLayoutProps> = ({ row, cohortData, finalCohortSizes }) => {
  const hasComments = useMemo(
    () => (row.registry?.comments ?? []).some((c) => c.text),
    [row],
  );

  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'description':
          return <DescriptionPanel row={row} />;
        case 'visualization':
          return <VisualizationPanel name={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        case 'comments':
          return <CommentsPanel row={row} />;
        default:
          return null;
      }
    },
    [row, cohortData, finalCohortSizes],
  );

  return (
    <CellLayoutFrame
      rowType="boolean"
      defaultJson={DEFAULT_JSON}
      showCommentsToggle={hasComments}
      factory={factory}
    />
  );
};
