import { TableData, ColumnDefinition } from '../CohortViewer/tableTypes';
import { themeQuartz } from 'ag-grid-community';

import { ConstantsCellRenderer } from './ConstantsCellRenderer';
import { ConstantsCellEditorSelector } from './ConstantsCellEditorSelector';

const defaultColumns: ColumnDefinition[] = [
  {
    field: 'name',
    headerName: 'Name',
    width: 200,
    pinned: 'left',
    editable: true,
  },
  {
    field: 'description',
    headerName: 'Description',
    editable: true,
    wrapText: true,
    width: 180,
  },
  {
    field: 'type',
    headerName: 'Type',
    editable: true,
    wrapText: false,
    width: 20,
  },
  {
    field: 'value',
    headerName: 'Value',
    editable: true,
    width: 1000,
    maxWidth: 1000,
    minWidth: 300,
    cellEditorPopup: true,
    cellRenderer: ConstantsCellRenderer,
    cellEditor: ConstantsCellEditorSelector,
    valueParser: params => params.newValue,
    valueSetter: params => {
      params.data.value = params.newValue;
      return true;
    },
    type: 'text',
  },
];

interface Constant {
  name: string;
  description: string;
  type: string;
  value: any;
}

const DEFAULT_CONSTANTS: Constant[] = [
  {
    name: 'data_period',
    description: 'all available data',
    type: 'DateFilter',
    value: { class_name: 'DateRangeFilter', min_date: null, max_date: null, type: 'date_range' },
  },
  {
    name: 'index_period',
    description: '2016-2023',
    type: 'DateFilter',
    value: {
      class_name: 'DateRangeFilter',
      min_date: '2016-01-01',
      max_date: '2023-12-31',
      type: 'date_range',
    },
  },
  {
    name: 'domains',
    description: 'OMOP domains',
    type: 'array',
    value: ['condition_occurrence', 'observation_period'],
  },
  {
    name: 'baseline_period',
    description: 'one_year_pre_index',
    type: 'RelativeTimeRangeFilter',
    value: { class_name: 'RelativeTimeRangeFilter', when: 'before', type: 'relative_time_range' },
  },
  {
    name: 'followup_period',
    description: 'any_time_post_index',
    type: 'RelativeTimeRangeFilter',
    value: { class_name: 'RelativeTimeRangeFilter', when: 'after', type: 'relative_time_range' },
  },
  // {
  //   name: 'inpatient',
  //   description: 'Inpatient filter',
  //   type: 'categorical_filter',
  //   value: { class_name: 'CategoricalFilter', allowed_values: [] },
  // },
  // {
  //   name: 'outpatient',
  //   description: 'Outpatient filter',
  //   type: 'categorical_filter',
  //   value: { class_name: 'CategoricalFilter', allowed_values: [] },
  // },
];

export class ConstantsDataService {
  private cohortDataService: any;
  private columns: ColumnDefinition[] = defaultColumns;
  public tableData: TableData = {
    rows: [],
    columns: this.columns,
  };
  constructor() {}

  public setCohortDataService(dataService: any) {
    this.cohortDataService = dataService;
    this.createDefaultConstants();
    this.tableData = this.tableDataFromConstants();
  }

  private createDefaultConstants() {
    if (!this.cohortDataService.cohort_data.constants) {
      this.cohortDataService.cohort_data.constants = {};
      DEFAULT_CONSTANTS.forEach(constant => {
        this.cohortDataService.cohort_data.constants[constant.name] = {
          description: constant.description,
          type: constant.type,
          value: constant.value,
        };
      });
    }
  }

  public addConstant(name: string, description: string, type: string, value: any) {
    this.cohortDataService.cohort_data.constants[name] = {
      description,
      type,
      value,
    };
  }

  public deleteConstant(name: string) {
    delete this.cohortDataService.cohort_data.constants[name];
  }

  public getConstantsOfType(type: string): Record<string, any> {
    const result: Record<string, any> = {};
    Object.entries(this.cohortDataService.cohort_data.constants).forEach(
      ([name, constant]: [string, any]) => {
        if (constant.type === type) {
          result[name] = constant;
        }
      }
    );
    return result;
  }

  public tableDataFromConstants(): TableData {
    const rows = Object.entries(this.cohortDataService.cohort_data.constants).map(
      ([name, constant]: [string, any]) => ({
        name,
        description: constant.description,
        type: constant.type,
        value: JSON.stringify(constant.value),
      })
    );

    return {
      rows,
      columns: this.columns,
    };
  }

  public getTheme() {
    return themeQuartz.withParams({
      accentColor: '#FF00000',
      borderColor: 'var(--line-color-grid)',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 14,
      headerFontWeight: 'bold',
      // headerRowBorder: false,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'var(--background-color, red)',
      // rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
      backgroundColor: 'transparent',
    });
  }

  public valueChanged(rowData: ParamRow, newValue: any) {
    this.currentPhenotype[rowData.parameter] = newValue;
    this.saveChangesToPhenotype();
  }

  public saveChangesToConstants() {
    // this.notifyListeners(false);
    this.cohortDataService.setConstants(this.tableData.rows);
  }
}
