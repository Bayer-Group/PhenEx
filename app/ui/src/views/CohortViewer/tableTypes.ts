export interface TableRow {
  [key: string]: any;
}

export interface ColumnDefinition {
  field: string;
  headerName?: string;
  flex?: number;
  width?: number;
  sortable?: boolean;
  filter?: boolean;
  resizable?: boolean;
  pinned?: 'left' | 'right' | boolean | null;
  editable?: boolean | ((params: any) => boolean);
  cellEditor?: any;
  cellEditorParams?: any;
  cellEditorPopup?: boolean;
  cellEditorSelector?: (params: any) => any;
  cellRenderer?: any;
  cellStyle?: any;
  cellClass?: string;
  rowDrag?: boolean | ((params: any) => boolean);
  suppressHeaderMenuButton?: boolean;
  valueParser?: (params: any) => any;
  [key: string]: any; // Allow additional ag-Grid properties
}

export interface TableData {
  rows: TableRow[];
  columns: ColumnDefinition[];
}

export interface TableGroup {
  id: string;
  name: string;
  data: TableData;
}
