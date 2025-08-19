import { TableData, ColumnDefinition } from '../../CohortViewer/tableTypes';
import { themeQuartz } from 'ag-grid-community';
import { defaultColumns } from '../../CohortViewer/CohortDataService/CohortColumnDefinitions';

const visibilityColumns: ColumnDefinition[] = [
  {
    field: 'dragHandle',
    headerName: '',
    width: 50,
    pinned: 'left',
    editable: false,
    cellRenderer: 'agRowDragCellRenderer',
    rowDrag: (params: any) => params.data.visible, // Only allow dragging visible rows
  },
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
  dragHandle?: string;
  column: string;
  visible: boolean;
  description: string;
  index: number;
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
    const rows: VisibilityRow[] = defaultColumns.map((column, index) => ({
      dragHandle: '', // Empty value for drag handle column
      column: column.headerName || column.field,
      visible: true,
      description: '', // Empty for now as requested
      index: index,
    }));

    // Sort initially by column name since all are visible, then update indices
    rows.sort((a, b) => a.column.localeCompare(b.column));
    this.updateIndices(rows);

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
      
      if (visible) {
        // When making visible, add to end of visible items
        const visibleRows = this._tableData.rows.filter(r => r.visible);
        row.index = visibleRows.length - 1;
      }
      
      this.sortRowsByVisibility();
    }
  }

  private sortRowsByVisibility(): void {
    this._tableData.rows.sort((a, b) => {
      // Sort by visible first (true before false), then by index for visible items, then by column name for invisible items
      if (a.visible === b.visible) {
        if (a.visible) {
          // For visible items, sort by index (drag order)
          return a.index - b.index;
        } else {
          // For invisible items, sort alphabetically
          return a.column.localeCompare(b.column);
        }
      }
      return b.visible ? 1 : -1; // visible (true) rows come first
    });
  }

  private updateIndices(rows: VisibilityRow[]): void {
    rows.forEach((row, index) => {
      row.index = index;
    });
  }

  public reorderRows(fromIndex: number, toIndex: number): void {
    const rows = this._tableData.rows;
    const fromRow = rows[fromIndex];
    const toRow = rows[toIndex];

    // Only allow reordering within visible items
    if (!fromRow.visible || !toRow.visible) {
      return;
    }

    // Remove the item from its current position
    rows.splice(fromIndex, 1);
    // Insert it at the new position
    rows.splice(toIndex, 0, fromRow);

    // Update indices for all visible rows
    const visibleRows = rows.filter(row => row.visible);
    visibleRows.forEach((row, index) => {
      row.index = index;
    });
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

  public getOrderedVisibleColumns(): string[] {
    return this._tableData.rows
      .filter(row => row.visible)
      .sort((a, b) => a.index - b.index)
      .map(row => row.column);
  }
}
