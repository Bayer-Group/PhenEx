import { TableData, ColumnDefinition } from '../../CohortViewer/tableTypes';
import { themeQuartz } from 'ag-grid-community';
import { defaultColumns } from '../../CohortViewer/CohortDataService/CohortColumnDefinitions';

const visibilityColumns: ColumnDefinition[] = [
  {
    field: 'column',
    headerName: 'Column',
    width: 200,
    pinned: 'left',
    editable: false,
  },
  {
    field: 'visible',
    headerName: 'Visible',
    width: 120,
    editable: true,
    cellEditor: 'agCheckboxCellEditor',
    cellRenderer: 'agCheckboxCellRenderer',
  },
  {
    field: 'description',
    headerName: 'Description',
    editable: false,
    width: 300,
    flex: 1,
  },
];

interface VisibilityRow {
  column: string;
  visible: boolean;
  description: string;
}

export class VisibilityDataService {
  private static instance: VisibilityDataService;
  private _tableData: TableData;

  private constructor() {
    this._tableData = this.initializeTableData();
  }

  public static getInstance(): VisibilityDataService {
    if (!VisibilityDataService.instance) {
      VisibilityDataService.instance = new VisibilityDataService();
    }
    return VisibilityDataService.instance;
  }

  private initializeTableData(): TableData {
    const rows: VisibilityRow[] = defaultColumns.map(column => ({
      column: column.headerName || column.field,
      visible: true,
      description: '', // Empty for now as requested
    }));

    return {
      rows,
      columns: visibilityColumns,
    };
  }

  get tableData(): TableData {
    return this._tableData;
  }

  public getTheme() {
    return themeQuartz;
  }

  public updateVisibility(columnName: string, visible: boolean): void {
    const row = this._tableData.rows.find(r => r.column === columnName);
    if (row) {
      row.visible = visible;
    }
  }

  public getVisibleColumns(): string[] {
    return this._tableData.rows
      .filter(row => row.visible)
      .map(row => row.column);
  }

  public getHiddenColumns(): string[] {
    return this._tableData.rows
      .filter(row => !row.visible)
      .map(row => row.column);
  }
}
