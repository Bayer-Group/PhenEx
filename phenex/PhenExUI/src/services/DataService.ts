import {
  TableData,
  TableGroup,
  GroupedTableData,
  ColumnDefinition,
  TableRow,
} from '../components/RightPanel/Tables/tableTypes';

export class DataService {
  private static instance: DataService;

  private constructor() {}

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  public async fetchTableData(): Promise<TableData> {
    try {
      // Simulated API call - replace with actual API implementation
      const mockData: TableData = {
        rows: [
          { type: 'Entry', id: 1, name: 'Inpatient ARDS', value: 100, phenotype: 'Codelist' },
          { type: 'Inclusion', id: 3, name: 'Age >=18', value: 300, phenotype: 'Codelist' },
          {
            type: 'Inclusion',
            id: 4,
            name: 'Continuous coverage',
            value: 400,
            phenotype: 'Codelist',
          },
          { type: 'Inclusion', id: 5, name: 'ICU stay', value: 400, phenotype: 'Codelist' },
          { type: 'Exclusion', id: 6, name: 'Pneumonia', value: 300, phenotype: 'Codelist' },
          { type: 'Baseline', id: 7, name: 'Age', value: 300, phenotype: 'Codelist' },
          {
            type: 'Baseline',
            id: 8,
            name: 'Coronary Artery Disease',
            value: 400,
            phenotype: 'Codelist',
          },
          { type: 'Baseline', id: 9, name: 'Heart Failure', value: 400, phenotype: 'Codelist' },
          { type: 'Baseline', id: 10, name: 'CKD', value: 400, phenotype: 'Codelist' },
          { type: 'Baseline', id: 11, name: 'Liver Disease', value: 400, phenotype: 'Codelist' },
          {
            type: 'Exclusion',
            id: 12,
            name: 'Cardiovascular Death',
            value: 300,
            phenotype: 'Codelist',
          },
          { type: 'Exclusion', id: 13, name: 'Hospitalization', value: 400, phenotype: 'Codelist' },
        ],
        columns: [
          { field: 'type', headerName: 'Type', width: 120, pinned: 'left' },
          { field: 'name', headerName: 'Name', width: 250, pinned: 'left' },
          { field: 'phenotype', headerName: 'Phenotype', width: 200 },
          { field: 'codelists', headerName: 'Codelists', width: 200 },
          { field: 'categorical_filters', headerName: 'Categorical filters', width: 200 },
          { field: 'relative_time_range', headerName: 'Relative time ranges', width: 200 },
          { field: 'date_range', headerName: 'Relative time range', width: 200 },
          { field: 'value', headerName: 'Value', width: 150 },
        ],
      };
      return mockData;
    } catch (error) {
      console.error('Error fetching table data:', error);
      throw error;
    }
  }

  public async fetchGroupedTableData(): Promise<GroupedTableData> {
    try {
      // Simulated API call - replace with actual API implementation
      const columns = [
        { field: 'name', headerName: 'Name', width: 400 },
        { field: 'phenotype', headerName: 'Phenotype', width: 200 },
        { field: 'codelists', headerName: 'Codelists', width: 200 },
        { field: 'categorical_filters', headerName: 'Categorical filters', width: 200 },
        { field: 'relative_time_range', headerName: 'Relative time ranges', width: 200 },
        { field: 'date_range', headerName: 'Relative time range', width: 200 },
        { field: 'value', headerName: 'Value', width: 150 },
      ];
      const mockGroupedData: GroupedTableData = {
        groups: [
          {
            id: 'group1',
            name: 'Entry Criterium',
            data: {
              rows: [{ id: 1, name: 'Inpatient ARDS', value: 100 }],
              columns: columns,
            },
          },
          {
            id: 'group2',
            name: 'Inclusion Criteria',
            data: {
              rows: [
                { id: 3, name: 'Age >=18', value: 300 },
                { id: 4, name: 'Continuous coverage', value: 400 },
                { id: 5, name: 'ICU stay', value: 400 },
              ],
              columns: columns,
            },
          },
          {
            id: 'group3',
            name: 'Exclusion Criteria',
            data: {
              rows: [{ id: 6, name: 'Pneumonia', value: 300 }],
              columns: columns,
            },
          },
          {
            id: 'group4',
            name: 'Baseline Characteristics',
            data: {
              rows: [
                { id: 7, name: 'Age', value: 300 },
                { id: 8, name: 'Coronary Artery Disease', value: 400 },
                { id: 9, name: 'Heart Failure', value: 400 },
                { id: 10, name: 'CKD', value: 400 },
                { id: 11, name: 'Liver Disease', value: 400 },
              ],
              columns: columns,
            },
          },
          {
            id: 'group5',
            name: 'Outcomes',
            data: {
              rows: [
                { id: 12, name: 'Cardiovascular Death', value: 300 },
                { id: 13, name: 'Hospitalization', value: 400 },
              ],
              columns: columns,
            },
          },
        ],
      };
      return mockGroupedData;
    } catch (error) {
      console.error('Error fetching grouped table data:', error);
      throw error;
    }
  }
}
