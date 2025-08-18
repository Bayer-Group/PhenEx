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
import { TypeSelectorCellEditor } from '../CohortTable/CellEditors/TypeSelectorCellEditor';
import { DescriptionCellEditor } from '../CohortTable/CellEditors/DescriptionCellEditor';
import { SettingsCellEditor } from '../CohortTable/CellEditors/SettingsCellEditor';

export const columnNameToApplicablePhenotypeMapping = {
  relative_time_range: ['CodelistPhenotype', 'MeasurementPhenotype', 'TimeRangePhenotype'],
  value_filter: ['MeasurementPhenotype', 'AgePhenotype'],
  categorical_filter: ['CodelistPhenotype', 'MeasurementPhenotype', 'CategoricalPhenotype'],
  codelist: ['CodelistPhenotype', 'MeasurementPhenotype'],
};

export const defaultColumns = [
  {
    field: 'type',
    headerName: 'Type',
    width: 100,
    pinned: 'left',
    editable: true,
    cellEditor: TypeSelectorCellEditor,
    cellEditorParams: {
      values: ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'],
    },
    cellRenderer: TypeCellRenderer,
    cellEditorPopup: true,
  },
  {
    field: 'name',
    headerName: 'Name',
    width: 200,
    pinned: 'left',
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
  {
    field: 'description',
    headerName: 'Description',
    width: 250,
    editable: true,
    cellEditor: DescriptionCellEditor,
    cellEditorPopup: true,
    cellRenderer: DescriptionCellRenderer,
  },
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
];
