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
  editable?: boolean;
  cellEditor?: any;
  cellEditorParams?: any;
  cellRenderer?: any;
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
