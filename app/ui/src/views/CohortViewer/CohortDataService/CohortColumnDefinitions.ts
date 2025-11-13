import TypeCellRenderer from '../CohortTable/CellRenderers/TypeCellRenderer';
import NameCellRenderer from '../CohortTable/CellRenderers/NameCellRenderer';
import DescriptionCellRenderer from '../CohortTable/CellRenderers/DescriptionCellRenderer';
import CodelistCellRenderer from '../CohortTable/CellRenderers/CodelistCellRenderer';
import DomainCellRenderer from '../CohortTable/CellRenderers/DomainCellRenderer';
import PhenotypeCellRenderer from '../CohortTable/CellRenderers/PhenotypeCellRenderer';
import { PhenexCellRenderer } from '../CohortTable/CellRenderers/PhenexCellRenderer';

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

import LogicalExpressionCellRenderer from '../CohortTable/CellRenderers/LogicalExpressionCellRenderer';

export const columnNameToApplicablePhenotypeMapping = {
  relative_time_range: ['CodelistPhenotype', 'MeasurementPhenotype', 'TimeRangePhenotype'],
  value_filter: ['MeasurementPhenotype', 'AgePhenotype'],
  categorical_filter: ['CodelistPhenotype', 'MeasurementPhenotype', 'CategoricalPhenotype'],
  codelist: ['CodelistPhenotype', 'MeasurementPhenotype'],
};

export const defaultColumns = [
  {
    field: 'rowDrag',
    headerName: '',
    width: 60,
    pinned: 'left',
    rowDrag: true,
    resizable: false,
    filter: false,
    suppressHeaderMenuButton: true,
    cellClass: 'row-drag-handle',
    cellStyle: { textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' },
  },
  {
    field: 'type',
    headerName: '',
    width: 100,
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
    width: 180,
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
    width: 200,
    editable: params => {
      return columnNameToApplicablePhenotypeMapping.codelist.includes(params.data.class_name);
    },
    valueParser: params => {
      // this is required for codelist cell editor return value type
      // as data types returned are variable (i.e. if codelist present vs not)
      // TODO add value validation here
      if (
        params.newValue &&
        typeof params.newValue === 'object' &&
        params.newValue.class_name === 'Codelist'
      ) {
        return params.newValue;
      }
      return params.oldValue;
    },
    cellRenderer: CodelistCellRenderer,
    cellEditor: CodelistCellEditor,
    cellEditorPopup: true,
  },
  {
    field: 'relative_time_range',
    headerName: 'Relative time ranges',
    width: 200,
    editable: params => {
      return (
        params.data.type !== 'entry' &&
        columnNameToApplicablePhenotypeMapping.relative_time_range.includes(params.data.class_name)
      );
    },
    valueParser: params => {
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
    editable: params => {
      return columnNameToApplicablePhenotypeMapping.value_filter.includes(params.data.class_name);
    },
    cellEditorPopup: true,
    valueParser: params => {
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
    editable: params => {
      return columnNameToApplicablePhenotypeMapping.categorical_filter.includes(
        params.data.class_name
      );
    },
    valueParser: params => {
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
    width: 250,
    editable: true,
    cellEditor: ReturnDateCellEditor,
    cellEditorPopup: true,
    cellRenderer: PhenexCellRenderer,
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
    field: 'expression',
    headerName: 'Expression',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: LogicalExpressionCellRenderer,
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
