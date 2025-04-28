import TypeCellRenderer from '../CohortTable/CellRenderers/TypeCellRenderer';
import NameCellRenderer from '../CohortTable/CellRenderers/NameCellRenderer';
import DescriptionCellRenderer from '../CohortTable/CellRenderers/DescriptionCellRenderer';
import CodelistCellRenderer from '../CohortTable/CellRenderers/CodelistCellRenderer';
import DomainCellRenderer from '../CohortTable/CellRenderers/DomainCellRenderer';
import PhenotypeCellRenderer from '../CohortTable/CellRenderers/PhenotypeCellRenderer';
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

export const defaultColumns = [
  {
    field: 'name',
    headerName: 'Name',
    width: 200,
    pinned: 'left',
    editable: true,
    cellRenderer: NameCellRenderer,
  },
  {
    field: 'type',
    headerName: 'Type',
    width: 80,
    pinned: 'left',
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'],
    },
    cellRenderer: TypeCellRenderer,
  },
  {
    field: 'count',
    headerName: 'N',
    width: 80,
    editable: false,
    cellRenderer: CountCellRenderer,
    wrapText: false,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 250,
    editable: true,
    cellEditor: 'agLargeTextCellEditor',
    cellEditorPopup: true,
    wrapText: true,
    cellEditorParams: {
      maxLength: 2000,
    },
    cellRenderer: DescriptionCellRenderer,
  },
  {
    field: 'class_name',
    headerName: 'Phenotype',
    width: 100,
    editable: true,
    cellRenderer: PhenotypeCellRenderer,
    cellEditor: PhenotypeSelectorCellEditor,
    cellEditorParams: {
      values: [
        'CodelistPhenotype',
        'MeasurementPhenotype',
        'ContinuousCoveragePhenotype',
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
    width: 120,
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
      return (
        params.data.class_name === 'MeasurementPhenotype' ||
        params.data.class_name === 'CodelistPhenotype'
      );
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
      console.log('CHECKING EDITABLE', params.data);
      return (
        params.data.type !== 'entry' &&
        (params.data.class_name === 'MeasurementPhenotype' ||
          params.data.class_name === 'CodelistPhenotype' ||
          params.data.class_name === 'ContinuousCoveragePhenotype'
        )
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
    editable: true,
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
    editable: true,
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
];
