import TypeCellRenderer from '../CohortTable/CellRenderers/TypeCellRenderer';
import NameCellRenderer from '../CohortTable/CellRenderers/NameCellRenderer';
import CodelistCellRenderer from '../CohortTable/CellRenderers/CodelistCellRenderer';
import DomainCellRenderer from '../CohortTable/CellRenderers/DomainCellRenderer';
import PhenotypeCellRenderer from '../CohortTable/CellRenderers/PhenotypeCellRenderer';
import { PhenexCellRenderer } from '../CohortTable/CellRenderers/PhenexCellRenderer';
import type { ICellEditorParams } from 'ag-grid-community';
import RowDragCellRenderer from '../CohortTable/CellRenderers/RowDragCellRenderer';
import SelectionCellRenderer from '../CohortTable/CellRenderers/SelectionCellRenderer';

import CountCellRenderer from '../CohortTable/CellRenderers/CountCellRenderer';
import CategoricalFilterCellRenderer from '../CohortTable/CellRenderers/CategoricalFilterCellRenderer';
import RelativeTimeRangeCellRenderer from '../CohortTable/CellRenderers/RelativeTimeRangeCellRenderer';
import ValueFilterCellRenderer from '../CohortTable/CellRenderers/ValueFilterCellRenderer';

import { CodelistCellEditor } from '../CohortTable/CellEditors/CodelistCellEditor';
import { RelativeTimeRangeFilterCellEditor } from '../CohortTable/CellEditors/RelativeTimeRangeFilterCellEditor';
import { CategoricalFilterCellEditor } from '../CohortTable/CellEditors/CategoricalFilterCellEditor';
import { ValueFilterCellEditor } from '../CohortTable/CellEditors/ValueFilterCellEditor';
import { PhenotypeSelectorCellEditor } from '../CohortTable/CellEditors/PhenotypeSelectorCellEditor';
import { DomainSelectorCellEditor } from '../CohortTable/CellEditors/DomainSelectorCellEditor';
import { TypeSelectorCellEditor } from '../CohortTable/CellEditors/TypeSelectorCellEditor';
import { DescriptionCellEditor } from '../CohortTable/CellEditors/DescriptionCellEditor';
import { SettingsCellEditor } from '../CohortTable/CellEditors/SettingsCellEditor';
import { ReturnDateCellEditor } from '../CohortTable/CellEditors/ReturnDateCellEditor';
import { LogicalExpressionCellEditor } from '../CohortTable/CellEditors/LogicalExpressionCellEditor';

import LogicalExpressionCellRenderer from '../CohortTable/CellRenderers/LogicalExpressionCellRenderer';

export const columnNameToApplicablePhenotypeMapping = {
  relative_time_range: ['CodelistPhenotype', 'MeasurementPhenotype', 'TimeRangePhenotype'],
  value_filter: ['MeasurementPhenotype', 'AgePhenotype'],
  categorical_filter: ['CodelistPhenotype', 'MeasurementPhenotype', 'CategoricalPhenotype'],
  codelist: ['CodelistPhenotype', 'MeasurementPhenotype'],
};

export const componentPhenotypeColumns: any[] = [
  {
    field: 'selection',
    headerName: '',
    width: 30,
    pinned: 'left',
    resizable: false,
    filter: false,
    suppressHeaderMenuButton: true,
    cellRenderer: SelectionCellRenderer,
  },
  {
    field: 'rowDrag',
    headerName: '',
    width: 30,
    pinned: 'left',
    rowDrag: true,
    resizable: false,
    filter: false,
    suppressHeaderMenuButton: true,
    cellClass: 'row-drag-handle',
    cellRenderer: RowDragCellRenderer,
  },
  {
    field: 'type',
    headerName: '',
    width: 50,
    filter: false,
    suppressHeaderMenuButton: true,
    resizable: false,
    pinned: 'left',
    editable: params => {
      return params.data.type != 'component';
    },
    cellEditor: TypeSelectorCellEditor,
    cellEditorParams: {
      values: ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'],
    },
    cellRenderer: TypeCellRenderer,
    cellEditorPopup: true,
  },
  {
    field: 'name',
    headerName: '',
    flex: 1,
    resizable: false,
    editable: true,
    cellRenderer: NameCellRenderer,
    cellEditor: 'agTextCellEditor',
    cellEditorSelector: (params: ICellEditorParams) => {
      if (params.eventKey == 'settings') {
        return {
          component: SettingsCellEditor,
          popup: true,
        };
      }
      return {
        component: 'agTextCellEditor',
      };
    },
  },
];

export const defaultColumns = [
  {
    field: 'selection',
    headerName: '',
    width: 10,
    pinned: 'left',
    resizable: false,
    filter: false,
    suppressHeaderMenuButton: true,
    cellRenderer: SelectionCellRenderer,
  },
  {
    field: 'rowDrag',
    headerName: '',
    width: 30,
    pinned: 'left',
    rowDrag: true,
    resizable: false,
    filter: false,
    suppressHeaderMenuButton: true,
    cellClass: 'row-drag-handle',
    cellRenderer: RowDragCellRenderer,
  },
  {
    field: 'type',
    headerName: '',
    width: 40,
    resizable: false,
    pinned: 'left',
    editable: (params: any) => {
      return params.data.type != 'component';
    },
    filter: false,
    suppressHeaderMenuButton: true,

    cellEditor: TypeSelectorCellEditor,
    cellEditorParams: {
      values: ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'],
    },
    cellRenderer: TypeCellRenderer,
    cellEditorPopup: true,
  },
  {
    field: 'name',
    headerName: '',
    width: 250,
    pinned: 'left',
    resizable: false,
    editable: true,
    cellRenderer: NameCellRenderer,
    cellEditor: 'agTextCellEditor',
    cellEditorSelector: (params: ICellEditorParams) => {
      if (params.eventKey == 'settings') {
        return {
          component: SettingsCellEditor,
          popup: true,
        };
      }
      return {
        component: 'agTextCellEditor',
      };
    },
  },
  // {
  //   field: 'description',
  //   headerName: 'Description',
  //   width: 250,
  //   editable: true,
  //   cellEditor: DescriptionCellEditor,
  //   cellEditorPopup: true,
  //   cellRenderer: DescriptionCellRenderer,
  // },
  {
    field: 'class_name',
    headerName: 'Phenotype',
    width: 130,
    editable: true,
    pinned: 'left',
    cellRenderer: PhenotypeCellRenderer,
    cellEditor: PhenotypeSelectorCellEditor,
    cellEditorParams: {
      values: [
        'CodelistPhenotype',
        'MeasurementPhenotype',
        'TimeRangePhenotype',
        'AgePhenotype',
        'DeathPhenotype',
        'LogicPhenotype',
        'ScorePhenotype',
        'ArithmeticPhenotype',
      ],
    },
    cellEditorPopup: true,
  },
  {
    field: 'domain',
    headerName: 'Domain',
    width: 270,
    editable: true,
    cellRenderer: DomainCellRenderer,
    cellEditor: DomainSelectorCellEditor,
    cellEditorPopup: true,

    cellEditorParams: {
      values: [
        'CONDITION_OCCURRENCE_SOURCE',
        'CONDITION_OCCURRENCE',
        'Drug Exposure',
        'Procedure Occurrence',
        'Person',
        'Observation',
      ],
    },
  },
  {
    field: 'codelist',
    headerName: 'Codelists',
    width: 400,
    editable: (params: any) => {
      return columnNameToApplicablePhenotypeMapping.codelist.includes(params.data.class_name);
    },
    valueParser: (params: any) => {
      console.log("=== CALLING VALUE PARSER ===", params);
      console.log("newValue:", params.newValue);
      console.log("newValue type:", typeof params.newValue);
      console.log("newValue is Array?:", Array.isArray(params.newValue));
      console.log("oldValue:", params.oldValue);
      
      // Accept arrays of Codelists (for complex item editors)
      if (Array.isArray(params.newValue)) {
        console.log("newValue is array, checking items...");
        console.log("Array length:", params.newValue.length);
        params.newValue.forEach((item: any, idx: number) => {
          console.log(`  Item ${idx}:`, item, "class_name:", item?.class_name);
        });
        // Validate all items are Codelists
        if (params.newValue.every((item: any) => item?.class_name === 'Codelist')) {
          console.log("All items are Codelists, accepting array");
          return params.newValue;
        } else {
          console.log("NOT all items are Codelists, rejecting");
        }
      }
      
      // Accept single Codelist (for backward compatibility)
      if (
        params.newValue &&
        typeof params.newValue === 'object' &&
        params.newValue.class_name === 'Codelist'
      ) {
        console.log("newValue is single Codelist, accepting");
        return params.newValue;
      }
      
      console.log("Rejecting newValue, returning oldValue");
      return params.oldValue;
    },
    cellRenderer: CodelistCellRenderer,
    cellEditor: CodelistCellEditor,
    cellEditorPopup: true,
  },
  {
    field: 'relative_time_range',
    headerName: 'Relative time ranges',
    width: 300,
    editable: (params: any) => {
      return (
        params.data.type !== 'entry' &&
        columnNameToApplicablePhenotypeMapping.relative_time_range.includes(params.data.class_name)
      );
    },
    valueParser: (params: any) => {
      if (params.newValue && typeof params.newValue === 'object') {
        return params.newValue;
      }
      return params.oldValue;
    },
    cellEditor: RelativeTimeRangeFilterCellEditor,
    cellRenderer: RelativeTimeRangeCellRenderer,
    cellEditorPopup: true,
    cellEditorParams: {
      maxLength: 2000,
    },
  },

  // { field: 'date_range', headerName: 'Date range', width: 200, editable: true },
  {
    field: 'value_filter',
    headerName: 'Value filters',
    width: 150,
    editable: (params: any) => {
      return columnNameToApplicablePhenotypeMapping.value_filter.includes(params.data.class_name);
    },
    cellEditorPopup: true,
    valueParser: (params: any) => {
      if (params.newValue && typeof params.newValue === 'object') {
        return params.newValue;
      }
      return params.oldValue;
    },
    cellEditor: ValueFilterCellEditor,
    cellRenderer: ValueFilterCellRenderer,
  },
  {
    field: 'categorical_filter',
    headerName: 'Categorical filters',
    width: 400,
    editable: (params: any) => {
      return columnNameToApplicablePhenotypeMapping.categorical_filter.includes(
        params.data.class_name
      );
    },
    valueParser: (params: any) => {
      if (params.newValue && typeof params.newValue === 'object') {
        return params.newValue;
      }
      return params.oldValue;
    },
    cellRenderer: CategoricalFilterCellRenderer,
    cellEditor: CategoricalFilterCellEditor,
    cellEditorPopup: true,
  },
  {
    field: 'return_date',
    headerName: 'Return Date',
    width: 150,
    editable: true,
    cellEditor: ReturnDateCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'expression',
    headerName: 'Expression',
    width: 500,
    editable: true,
    valueParser: (params: any) => {
      if (params.newValue && typeof params.newValue === 'object') {
        return params.newValue;
      }
      return params.oldValue;
    },
    cellEditor: LogicalExpressionCellEditor,
    cellEditorPopup: true,
    cellRenderer: LogicalExpressionCellRenderer,
  },
  {
    field: 'direction',
    headerName: 'Direction',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'component_date_select',
    headerName: 'Component Date Select',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'anchor_phenotype',
    headerName: 'Anchor Phenotype',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'further_value_filter_phenotype',
    headerName: 'Further Value Filter Phenotype',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'date_range',
    headerName: 'Date Range',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'clean_nonphysiologicals_value_filter',
    headerName: 'Clean Nonphysiologicals Value Filter',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: ValueFilterCellRenderer,
  },
  {
    field: 'bins',
    headerName: 'Bins',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'function',
    headerName: 'Function',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'min_change',
    headerName: 'Min Change',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'max_change',
    headerName: 'Max Change',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'min_days_between',
    headerName: 'Min Days Between',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'max_days_between',
    headerName: 'Max Days Between',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'return_value',
    headerName: 'Return Value',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'value_aggregation',
    headerName: 'Value Aggregation',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'clean_null_values',
    headerName: 'Clean Null Values',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
  {
    field: 'allow_null_end_date',
    headerName: 'Allow Null End Date',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
  },
];
