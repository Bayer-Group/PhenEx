/**
 * gridApiShim
 *
 * A minimal emulation of the slice of the AG Grid API that the existing
 * Cohort cell renderers and cell editors depend on. This lets CohortCardViewer
 * reuse the exact same renderers / editors / column definitions that CohortTable
 * (AG Grid) uses, without pulling in AG Grid itself.
 *
 * The renderers consume `ICellRendererParams` and call:
 *   - props.api.startEditingCell({ rowIndex, colKey, key })
 *   - props.node.isSelected() / props.node.rowIndex
 *   - props.column.getColId() / props.colDef.field / props.value / props.data
 *
 * The editors consume `ICellEditorParams`, expose getValue() via a ref, and call:
 *   - props.api.stopEditing()
 *   - props.eGridCell (for popup positioning)
 *   - props.value / props.data / props.column / props.colDef
 */

export interface ShimColumn {
  getColId: () => string;
  getColDef: () => any;
  getActualWidth: () => number;
}

export interface ShimNode {
  id: string;
  data: any;
  rowIndex: number;
  isSelected: () => boolean;
  setSelected: (selected: boolean) => void;
  setDataValue: (field: string, value: any) => void;
}

export interface ShimApi {
  startEditingCell: (params: { rowIndex: number; colKey: string; key?: string }) => void;
  stopEditing: (cancel?: boolean) => void;
  getColumnDef: (field: string) => any | null;
  refreshCells: (params?: any) => void;
  redrawRows: (params?: any) => void;
  resetRowHeights: () => void;
  getSelectedRows: () => any[];
  getSelectedNodes: () => ShimNode[];
  forEachNode: (cb: (node: ShimNode, index: number) => void) => void;
  getRowNode: (id: string) => ShimNode | undefined;
  deselectAll: () => void;
  ensureNodeVisible: (node: any) => void;
  setGridOption: (key: string, value: any) => void;
  isDestroyed: () => boolean;
}

/**
 * Backing state + side-effect hooks that the shim api reads/writes.
 * All getters read live state so params built at render time stay correct.
 */
export interface ShimBacking {
  getRows: () => any[];
  getColumns: () => any[];
  getSelectedIds: () => Set<string>;
  setSelected: (id: string, selected: boolean) => void;
  deselectAll: () => void;
  startEditingCell: (params: { rowIndex: number; colKey: string; key?: string }) => void;
  stopEditing: (cancel?: boolean) => void;
  requestRefresh: () => void;
  ensureRowVisible: (id: string) => void;
  setGridOption: (key: string, value: any) => void;
}

export function makeColumn(colDef: any): ShimColumn {
  return {
    getColId: () => colDef.field,
    getColDef: () => colDef,
    getActualWidth: () => colDef.width ?? 150,
  };
}

export function makeNode(rowData: any, rowIndex: number, backing: ShimBacking): ShimNode {
  const id = rowData?.id ?? String(rowIndex);
  return {
    id,
    data: rowData,
    rowIndex,
    isSelected: () => backing.getSelectedIds().has(id),
    setSelected: (selected: boolean) => backing.setSelected(id, selected),
    setDataValue: (field: string, value: any) => {
      rowData[field] = value;
      backing.requestRefresh();
    },
  };
}

export function createShimApi(backing: ShimBacking): ShimApi {
  const nodeFor = (rowData: any, index: number) => makeNode(rowData, index, backing);

  return {
    startEditingCell: params => backing.startEditingCell(params),
    stopEditing: cancel => backing.stopEditing(cancel),
    getColumnDef: (field: string) => backing.getColumns().find(c => c.field === field) ?? null,
    refreshCells: () => backing.requestRefresh(),
    redrawRows: () => backing.requestRefresh(),
    resetRowHeights: () => backing.requestRefresh(),
    getSelectedRows: () => {
      const ids = backing.getSelectedIds();
      return backing.getRows().filter(r => ids.has(r?.id));
    },
    getSelectedNodes: () => {
      const ids = backing.getSelectedIds();
      return backing
        .getRows()
        .map((r, i) => nodeFor(r, i))
        .filter(n => ids.has(n.id));
    },
    forEachNode: cb => {
      backing.getRows().forEach((r, i) => cb(nodeFor(r, i), i));
    },
    getRowNode: (id: string) => {
      const rows = backing.getRows();
      const idx = rows.findIndex(r => r?.id === id);
      if (idx === -1) return undefined;
      return nodeFor(rows[idx], idx);
    },
    deselectAll: () => backing.deselectAll(),
    ensureNodeVisible: (node: any) => {
      const id = typeof node === 'string' ? node : node?.id ?? node?.data?.id;
      if (id) backing.ensureRowVisible(id);
    },
    setGridOption: (key: string, value: any) => backing.setGridOption(key, value),
    isDestroyed: () => false,
  };
}

/** Build the params object passed to a cell RENDERER for a given row/column. */
export function makeRendererParams(opts: {
  rowData: any;
  rowIndex: number;
  colDef: any;
  api: ShimApi;
  backing: ShimBacking;
  eGridCell: HTMLElement | null;
}): any {
  const { rowData, rowIndex, colDef, api, backing, eGridCell } = opts;
  const column = makeColumn(colDef);
  const node = makeNode(rowData, rowIndex, backing);
  const value = rowData?.[colDef.field];

  return {
    value,
    valueFormatted: null,
    data: rowData,
    node,
    colDef,
    column,
    api,
    context: {},
    eGridCell,
    rowIndex,
    refreshCell: () => backing.requestRefresh(),
    registerRowDragger: () => {},
    setValue: (v: any) => node.setDataValue(colDef.field, v),
    setTooltip: () => {},
    ...(colDef.cellRendererParams || {}),
  };
}

/** Build the params object passed to a cell EDITOR for a given row/column. */
export function makeEditorParams(opts: {
  rowData: any;
  rowIndex: number;
  colDef: any;
  api: ShimApi;
  backing: ShimBacking;
  eGridCell: HTMLElement | null;
  eventKey?: string;
  onValueChange: (value: any) => void;
}): any {
  const { rowData, rowIndex, colDef, api, backing, eGridCell, eventKey, onValueChange } = opts;
  const column = makeColumn(colDef);
  const node = makeNode(rowData, rowIndex, backing);
  const value = rowData?.[colDef.field];

  return {
    value,
    data: rowData,
    node,
    colDef,
    column,
    api,
    context: {},
    eGridCell,
    rowIndex,
    eventKey,
    cellStartedEdit: true,
    onValueChange,
    stopEditing: (cancel?: boolean) => api.stopEditing(cancel),
    parseValue: (v: any) => v,
    formatValue: (v: any) => v,
    ...(colDef.cellEditorParams || {}),
  };
}

/**
 * Resolve which editor component to use for a column, honoring cellEditorSelector.
 * Returns { component, popup } where component may be the string 'agTextCellEditor'.
 */
export function resolveEditor(colDef: any, params: any): { component: any; popup: boolean } {
  if (typeof colDef.cellEditorSelector === 'function') {
    const selected = colDef.cellEditorSelector(params);
    if (selected && selected.component) {
      return { component: selected.component, popup: !!selected.popup };
    }
  }
  return { component: colDef.cellEditor, popup: !!colDef.cellEditorPopup };
}

/** Whether a column is editable for a given row (supports boolean or predicate). */
export function isColumnEditable(colDef: any, rowData: any, api: ShimApi): boolean {
  if (colDef.editable === undefined) return false;
  if (typeof colDef.editable === 'function') {
    return !!colDef.editable({ data: rowData, colDef, api });
  }
  return !!colDef.editable;
}
