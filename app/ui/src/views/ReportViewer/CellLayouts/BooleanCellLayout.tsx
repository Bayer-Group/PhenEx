import { FC, useCallback, useMemo } from 'react';
import { Layout, Model, IJsonModel } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import { type CohortClassified } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { BarChartCellRenderer } from '../GraphsAndTables/RowRenderers/BarChartCellRenderer';
import { useSharedLayout } from './CellLayoutStore';

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
      { type: 'tabset', weight: 30, children: [{ type: 'tab', name: 'Description', component: 'description' }] },
      { type: 'tabset', weight: 70, children: [{ type: 'tab', name: 'Visualization', component: 'visualization' }] },
    ],
  },
};

const DescriptionPanel: FC<{ row: SequentialRow }> = ({ row }) => (
  <div style={{ padding: 16, fontFamily: '"IBMPlexSans-regular", sans-serif', fontSize: 14, color: '#333' }}>
    <p style={{ margin: 0 }}>{row.registry?.description || 'No description available.'}</p>
  </div>
);

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
  const [layoutJson, setLayoutJson] = useSharedLayout('boolean', DEFAULT_JSON);
  const model = useMemo(() => Model.fromJson(layoutJson), [layoutJson]);

  const handleModelChange = useCallback(() => {
    setLayoutJson(model.toJson() as IJsonModel);
  }, [model, setLayoutJson]);

  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'description':
          return <DescriptionPanel row={row} />;
        case 'visualization':
          return <VisualizationPanel name={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
        default:
          return null;
      }
    },
    [row, cohortData, finalCohortSizes],
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <Layout model={model} factory={factory} onModelChange={handleModelChange} />
    </div>
  );
};
