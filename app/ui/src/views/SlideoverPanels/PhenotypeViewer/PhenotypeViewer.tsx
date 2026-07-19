import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './PhenotypeViewer.module.css';
import { PhenotypeDataService, Phenotype } from './PhenotypeDataService';
import { CohortCardCell } from '../../CohortViewer/CohortCardViewer/CohortCardCell';
import {
  ShimApi,
  ShimBacking,
  createShimApi,
  isColumnEditable,
} from '../../CohortViewer/CohortCardViewer/gridApiShim';
import typeStyles from '../../../styles/study_types.module.css';

interface PhenotypeViewerProps {
  data?: Phenotype;
}

/** Which cell (by row index + column field) is currently in edit mode. */
interface EditingState {
  rowIndex: number;
  field: string;
  eventKey?: string;
}

/**
 * PhenotypeViewer renders a phenotype's parameters as a simple two-column table
 * (parameter name + editable value). It reuses the exact same cell renderers and
 * editors as the cohort table via the gridApiShim, following the pattern of
 * CohortCardViewer — no AG Grid involved.
 */
export const PhenotypeViewer: React.FC<PhenotypeViewerProps> = ({ data }) => {
  const dataService = useRef(PhenotypeDataService.getInstance()).current;

  const [rows, setRows] = useState<any[]>(dataService.rowData);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [, forceTick] = useState(0);
  const [typeColorDim, setTypeColorDim] = useState('');

  // Live refs so shim callbacks always read the current values.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const editingRef = useRef<EditingState | null>(editing);
  editingRef.current = editing;
  const activeEditorRef = useRef<React.RefObject<any> | null>(null);

  const columns = useMemo(() => dataService.getColumnDefs(), [dataService]);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // ---------------------------------------------------------------------------
  // Shim api + backing (subset of the AG Grid api the renderers/editors expect)
  // ---------------------------------------------------------------------------
  const apiRef = useRef<ShimApi>(null as unknown as ShimApi);
  const emptySelection = useRef(new Set<string>()).current;

  const commitEdit = useCallback(
    (cancel?: boolean) => {
      const ed = editingRef.current;
      if (!ed) return;
      const editorRefObj = activeEditorRef.current;
      setEditing(null);
      activeEditorRef.current = null;
      if (cancel) return;

      const row = rowsRef.current[ed.rowIndex];
      const colDef = columnsRef.current.find(c => c.field === ed.field);
      if (!row || !colDef) return;

      const rawValue = editorRefObj?.current?.getValue?.();
      const oldValue = row[ed.field];
      let newValue = rawValue;
      if (typeof colDef.valueParser === 'function') {
        newValue = colDef.valueParser({ newValue: rawValue, oldValue, data: row, colDef });
      }
      if (newValue === oldValue) return;

      // Mirror AG Grid's valueSetter: mutate the row in place so the renderer
      // reflects the new value immediately.
      row.value = newValue;
      row[row.parameter] = newValue;
      dataService.valueChanged(row.parameter, newValue);
    },
    [dataService]
  );

  const startEditingCell = useCallback(
    (params: { rowIndex: number; colKey: string; key?: string }) => {
      const row = rowsRef.current[params.rowIndex];
      const colDef = columnsRef.current.find(c => c.field === params.colKey);
      if (!row || !colDef) return;
      if (!isColumnEditable(colDef, row, apiRef.current)) return;
      if (editingRef.current) commitEdit();
      setEditing({ rowIndex: params.rowIndex, field: params.colKey, eventKey: params.key });
    },
    [commitEdit]
  );

  const backing: ShimBacking = useMemo(
    () => ({
      getRows: () => rowsRef.current,
      getColumns: () => columnsRef.current,
      getSelectedIds: () => emptySelection,
      setSelected: () => {},
      deselectAll: () => {},
      startEditingCell,
      stopEditing: (cancel?: boolean) => commitEdit(cancel),
      requestRefresh: () => forceTick(t => t + 1),
      ensureRowVisible: () => {},
      setGridOption: (key: string, value: any) => {
        if (key === 'rowData') setRows(value ?? []);
      },
    }),
    [startEditingCell, commitEdit, emptySelection]
  );

  const api = useMemo(() => createShimApi(backing), [backing]);
  apiRef.current = api;

  // ---------------------------------------------------------------------------
  // Data wiring
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Re-pull the (possibly rebuilt) row data whenever the service notifies.
    const listener = () => setRows([...dataService.rowData]);
    dataService.addListener(listener);

    if (data) dataService.setData(data);
    setEditing(null);

    // // Type-based background tint on the grid container.
    // if (data?.effective_type && typeStyles[`${data.effective_type}_color_block_dim`]) {
    //   setTypeColorDim(typeStyles[`${data.effective_type}_color_block_dim`]);
    // } else {
    //   setTypeColorDim('');
    // }

    return () => dataService.removeListener(listener);
  }, [data, dataService]);

  // Escape cancels an in-flight edit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingRef.current) commitEdit(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [commitEdit]);

  const registerEditor = useCallback((editorRef: React.RefObject<any>) => {
    activeEditorRef.current = editorRef;
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!data) {
    return (
      <div className={styles.container}>
        <h2>Select a phenotype to view details</h2>
      </div>
    );
  }

  return (
    <div className={styles.gridWrapper}>
      <div className={`${styles.gridContainer} ag-root ${typeColorDim}`}>
        {editing && <div className={styles.editingOverlay} onClick={e => { e.stopPropagation(); commitEdit(); }} />}
        {rows.map((rowData, rowIndex) => (
          <div key={rowData?.parameter ?? rowIndex} className={styles.row}>
            {columns.map(colDef => (
              <CohortCardCell
                key={colDef.field}
                rowData={rowData}
                rowIndex={rowIndex}
                colDef={colDef}
                api={api}
                backing={backing}
                isEditing={editing?.rowIndex === rowIndex && editing.field === colDef.field}
                eventKey={
                  editing?.rowIndex === rowIndex && editing.field === colDef.field
                    ? editing.eventKey
                    : undefined
                }
                registerEditor={registerEditor}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
