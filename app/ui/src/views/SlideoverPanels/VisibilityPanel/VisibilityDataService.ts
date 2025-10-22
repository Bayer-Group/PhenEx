import { TableData, ColumnDefinition } from '../../CohortViewer/tableTypes';
import { themeQuartz } from 'ag-grid-community';
import { defaultColumns } from '../../CohortViewer/CohortDataService/CohortColumnDefinitions';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { VisibilityCellRenderer } from './VisibilityCellRenderer';
import VisibilityDescriptionCellRenderer from './VisibilityDescriptionCellRenderer';
import { VisibilityPhenotypeParamCellRenderer } from './VisibilityPhenotypeParamCellRenderer';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
let parametersInfo = JSON.parse(parametersInfoRaw);

const visibilityColumns: ColumnDefinition[] = [
  {
    field: 'dragHandle',
    headerName: '',
    maxWidth: 60,
    minWidth: 60,
    width: 60,
    flex: 0,
    rowDrag: true,
    suppressMenu: true,
    suppressSorting: true,
    suppressFilter: true,
    cellClass: 'row-drag-handle',
    suppressMovable: true,
    cellStyle: { display: 'flex', justifyContent: 'flex-end'},
  },
  {
    field: 'visible',
    headerName: '',
    resizable: false,
    maxWidth: 40,
    minWidth: 40,
    width: 40,
    flex: 0,
    editable: false, // Changed to false since the renderer handles the interaction
    cellRenderer: VisibilityCellRenderer,
    suppressMovable: true,
  },
  {
    field: 'column',
    headerName: 'Column',
    minWidth: 100,
    flex: 1,
    editable: false,
    cellRenderer: VisibilityPhenotypeParamCellRenderer,
    resizable: false,
    suppressMovable: true,
  },
  {
    field: 'usedBy',
    headerName: 'Used by',
    editable: false,
    width: 100,
    resizable: false,
    maxWidth: 100,
    cellRenderer: VisibilityDescriptionCellRenderer,
    suppressMovable: true,
  },
];

interface VisibilityRow {
  dragHandle?: string;
  column: string;
  visible: boolean;
  usedBy: string;
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
    // Filter out the rowDrag, type, and name columns - users shouldn't see or control them
    const filteredColumns = defaultColumns.filter(
      column => column.field !== 'rowDrag' && column.field !== 'type' && column.field !== 'name'
    );
    console.log("PARM INFO", parametersInfo)
    // Helper function to get description from parameters_info.json
    const getDescriptionForField = (fieldName: string): string => {
      const paramInfo = parametersInfo[fieldName as keyof typeof parametersInfo];
      const fullDescription = paramInfo?.description || '';
      
      // Extract only the first sentence (up to the first period)
      const firstSentence = fullDescription.split('.')[0];
      return firstSentence ? firstSentence + '.' : '';
    };

    // Helper function to get phenotypes that use this field
    const getUsedByForField = (fieldName: string): string => {
      const paramInfo = parametersInfo[fieldName as keyof typeof parametersInfo];
      const phenotypes = paramInfo?.phenotypes || [];
      return Array.isArray(phenotypes) ? phenotypes.join(', ') : '';
    };

    console.log(filteredColumns, "THIS IS FILTERED COLS")
    const rows: VisibilityRow[] = filteredColumns.map((column, index) => ({
      dragHandle: '', // Empty value for drag handle column
      column: column.field || column.headerName,
      visible: true,
      usedBy: getUsedByForField(column.field),
      description: getDescriptionForField(column.headerName),
      index: index,
    }));

    this.updateIndices(rows);

    // Update the CohortDataService with initial column configuration
    setTimeout(() => this.updateCohortDataServiceColumns(), 0);

    return {
      rows,
      columns: visibilityColumns,
    };
  }

  get tableData(): TableData {
    return this._tableData;
  }

  public getTheme() {
    return themeQuartz.withParams({
      accentColor: 'var(--color-accent-bright)',
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
      backgroundColor: 'var(--background-color)',
    });
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
      // Note: updateCohortDataServiceColumns() is called in sortRowsByVisibility()
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

    // Update the CohortDataService with the new column visibility and order
    this.updateCohortDataServiceColumns();
  }

  private updateCohortDataServiceColumns(): void {
    const cohortDataService = CohortDataService.getInstance();

    // Always get the rowDrag, type, and name columns first (they should always be present)
    const rowDragColumn = defaultColumns.find(col => col.field === 'rowDrag');
    const typeColumn = defaultColumns.find(col => col.field === 'type');
    const nameColumn = defaultColumns.find(col => col.field === 'name');

    // Get the ordered list of visible column names
    const visibleColumnNames = this.getOrderedVisibleColumns();

    // Filter and reorder defaultColumns based on visibility and order
    const visibleColumns = visibleColumnNames
      .map(columnName => {
        // Find the column in defaultColumns by matching headerName or field
        return defaultColumns.find(
          col => (col.headerName && col.headerName === columnName) || col.field === columnName
        );
      })
      .filter(col => col !== undefined);

    // Combine required columns (rowDrag, type, name) with visible columns
    const requiredColumns = [rowDragColumn, typeColumn, nameColumn].filter(
      col => col !== undefined
    );
    const finalColumns = [...requiredColumns, ...visibleColumns];

    console.log('Updating CohortDataService columns:', finalColumns);

    // Update the cohort data service columns using the public method
    cohortDataService.updateColumns(finalColumns as ColumnDefinition[]);
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

    console.log(visibleRows);
  }

  public getVisibleColumns(): string[] {
    return this._tableData.rows.filter(row => row.visible).map(row => row.column);
  }

  public getHiddenColumns(): string[] {
    return this._tableData.rows.filter(row => !row.visible).map(row => row.column);
  }

  public getOrderedVisibleColumns(): string[] {
    return this._tableData.rows
      .filter(row => row.visible)
      .sort((a, b) => a.index - b.index)
      .map(row => row.column);
  }

  public resortAllRows(): void {
    console.log('resortAllRows');
    // Simply call the existing sort method to maintain visible/invisible separation
    this.sortRowsByVisibility();
  }

  public updateRowOrder(newRowData: VisibilityRow[]): void {
    console.log('updateRowOrder called with:', newRowData);

    // Update our internal data with the new order
    this._tableData.rows = newRowData;

    // Update indices for visible rows based on their new positions
    const visibleRows = newRowData.filter(row => row.visible);
    visibleRows.forEach((row, index) => {
      row.index = index;
    });

    console.log('Updated visible rows with new indices:', visibleRows);

    // Then sort to maintain visible/invisible separation
    this.sortRowsByVisibility();
  }
}
