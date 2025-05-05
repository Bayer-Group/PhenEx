import { TableData, ColumnDefinition } from '../tableTypes';
import { themeQuartz } from 'ag-grid-community';

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
    type: 'daterangefilter',
    value: { class_name: 'DateRangeFilter', min_date: null, max_date: null },
  },
  {
    name: 'index_period',
    description: '2016-2023',
    type: 'daterangefilter',
    value: { class_name: 'DateRangeFilter', min_date: '2016-01-01', max_date: '2023-12-31' },
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
    type: 'relative_time_range_filter',
    value: { class_name: 'RelativeTimeRangeFilter', when: 'before' },
  },
  {
    name: 'followup_period',
    description: 'any_time_post_index',
    type: 'relative_time_range_filter',
    value: { class_name: 'RelativeTimeRangeFilter', when: 'after' },
  },
  {
    name: 'inpatient',
    description: 'Inpatient filter',
    type: 'categorical_filter',
    value: { class_name: 'CategoricalFilter', allowed_values: [] },
  },
  {
    name: 'outpatient',
    description: 'Outpatient filter',
    type: 'categorical_filter',
    value: { class_name: 'CategoricalFilter', allowed_values: [] },
  },
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
      accentColor: '#DDDDDD',
      borderColor: '#AFAFAF26',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 14,
      headerFontWeight: 'bold',
      headerRowBorder: true,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'var(--background-color-content, #FFFFFF)',
      rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
    });
  }
}
