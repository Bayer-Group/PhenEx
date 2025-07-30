import { TableData, ColumnDefinition } from '../CohortViewer/tableTypes';
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
    field: 'value',
    headerName: 'Value',
    editable: true,
  },
];

interface Constant {
  name: string;
  description: string;
  value: any;
}

const SNOWFLAKE_PARAMETERS: Constant[] = [
  {
    name: 'source_database',
    description: 'Source database name',
    value: '',
  },
  {
    name: 'destination_database',
    description: 'Destination database name',
    value: '',
  },
  {
    name: 'user',
    description: 'Snowflake username',
    value: 'default_user',
  },
  {
    name: 'account',
    description: 'Snowflake account identifier',
    value: 'default_account',
  },
  {
    name: 'warehouse',
    description: 'Snowflake warehouse name',
    value: 'default_warehouse',
  },
  {
    name: 'role',
    description: 'Snowflake role',
    value: 'default_role',
  },
  {
    name: 'password',
    description: 'Snowflake password',
    value: 'default_password',
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
      SNOWFLAKE_PARAMETERS.forEach(constant => {
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
}
