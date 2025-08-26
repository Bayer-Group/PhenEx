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
    // this.refreshConstants();
  }

  public refreshConstants() {
    this.createDefaultConstants();
    this.tableData = this.tableDataFromConstants();
  }

  private createDefaultConstants() {
    console.log("CREATING DEFAULT CONSTANTS", this.cohortDataService._cohort_data)
    if (!this.cohortDataService._cohort_data.constants) {
      this.cohortDataService._cohort_data.constants = DEFAULT_CONSTANTS;
      this.cohortDataService.saveChangesToCohort(false, false);
      console.log("SAVED CONSTANTS", this.cohortDataService._cohort_data)
    }
    else{
      console.log(this.cohortDataService._cohort_data.constants, "THESE ARE SAVED CONSTANTS")
    }
  }

  public addConstant() {
      console.log(this.cohortDataService._cohort_data.constants, "IN ADD")

    this.cohortDataService._cohort_data.constants.push({
      name: '',
      description:'',
      type: '',
      value:'',
    });

    this.cohortDataService.saveChangesToCohort(false, false);
  }

  public deleteConstant(name: string) {
    this.cohortDataService._cohort_data.constants = this.cohortDataService._cohort_data.constants.filter(
      (constant: any) => constant.name !== name
    );
  }

  public getConstantsOfType(type: string): Record<string, any> {
    const result: Record<string, any> = {};
    this.cohortDataService._cohort_data.constants.forEach(
      (constant: any) => {
        if (constant.type === type) {
          result[constant.name] = constant;
        }
      }
    );
    return result;
  }

  public tableDataFromConstants(): TableData {
    const rows = this.cohortDataService._cohort_data.constants.map(
      (constant: any) => ({
        name: constant.name,
        description: constant.description,
        type: constant.type,
        value: JSON.stringify(constant.value),
      })
    );

    return {
      rows: rows,
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

  public valueChanged(rowData: any, newValue: any) {
    // Find the constant in the cohort data and update it
    const constantIndex = this.cohortDataService._cohort_data.constants.findIndex(
      (constant: any) => constant.name === rowData.name
    );
    
    if (constantIndex !== -1) {
      // Update the specific field that changed
      const fieldName = rowData.parameter || 'value'; // Fallback to 'value' if parameter is not set
      if (fieldName === 'value') {
        // Try to parse JSON if it's a string, otherwise use as-is
        try {
          this.cohortDataService._cohort_data.constants[constantIndex].value = 
            typeof newValue === 'string' ? JSON.parse(newValue) : newValue;
        } catch {
          this.cohortDataService._cohort_data.constants[constantIndex].value = newValue;
        }
      } else {
        this.cohortDataService._cohort_data.constants[constantIndex][fieldName] = newValue;
      }
    }
    
    this.saveChangesToConstants();
  }

  public saveChangesToConstants() {
    this.cohortDataService.saveChangesToCohort(false, false);
    this.refreshConstants(); // Refresh to update the table data
  }
}
