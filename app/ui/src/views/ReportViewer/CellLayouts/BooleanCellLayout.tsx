import { FC, useCallback } from 'react';
import { type IJsonModel } from 'flexlayout-react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { DescriptionPanel } from './DescriptionPanel';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { BarChartCellRendererCompact } from '../GraphsAndTables/RowRenderers/BarChartCellRendererCompact';
import { CommentsPanel } from '../CommentsPanel';
import { CellLayoutFrame } from './CellLayoutFrame';

interface BooleanCellLayoutProps {
  row: SequentialRow;
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
}

/** Pixels per spacer unit in the larger presentation/visualization context. */
const PRESENTATION_SPACER_UNIT_PX = 14;

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


const VisualizationPanel: FC<{ name: string; cohortData: CohortClassified[]; finalCohortSizes?: Record<string, number | null>; spacers?: BarChartSpacer[] }> = ({ name, cohortData, finalCohortSizes, spacers }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box' }}>
      <BarChartCellRendererCompact
        data={{ name, _meta: { cohortData: filtered, finalCohortSizes, spacers } }}
        isModal
        pctDecimals={1}
        spacerUnitPx={PRESENTATION_SPACER_UNIT_PX}
      />
    </div>
  );
};

export const BooleanCellLayout: FC<BooleanCellLayoutProps> = ({ row, cohortData, finalCohortSizes, spacers }) => {
  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'description':
          return <DescriptionPanel row={row} />;
        case 'visualization':
          return <VisualizationPanel name={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} spacers={spacers} />;
        case 'comments':
          return <CommentsPanel row={row} />;
        default:
          return null;
      }
    },
    [row, cohortData, finalCohortSizes, spacers],
  );

  return (
    <CellLayoutFrame rowType="boolean" defaultJson={DEFAULT_JSON} factory={factory} />
  );
};
