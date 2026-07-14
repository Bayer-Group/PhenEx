import React from 'react';
import styles from './CohortCardViewer.module.css';
import { CohortCardCell } from './CohortCardCell';
import { ShimApi, ShimBacking } from './gridApiShim';
import { getHierarchicalBackgroundColor } from '../CohortTable/CellRenderers/PhenexCellRenderer';

interface CohortCardRowProps {
  rowData: any;
  rowIndex: number;
  columns: any[];
  api: ShimApi;
  backing: ShimBacking;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  /** The column field currently being edited in this row (if any). */
  editingField: string | null;
  editingEventKey?: string;
  enableDrag: boolean;
  registerRowRef: (id: string, el: HTMLDivElement | null) => void;
  registerEditor: (editorRef: React.RefObject<any>, onValueChange: (v: any) => void) => void;
  onRowMouseDown: (e: React.MouseEvent, rowIndex: number) => void;
  onRowClick: (e: React.MouseEvent, rowData: any, rowIndex: number) => void;
  onContextMenu: (e: React.MouseEvent, rowIndex: number) => void;
  onDragStart: (e: React.DragEvent, rowIndex: number) => void;
  onDragOver: (e: React.DragEvent, rowIndex: number) => void;
  onDrop: (e: React.DragEvent, rowIndex: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export const CohortCardRow: React.FC<CohortCardRowProps> = ({
  rowData,
  rowIndex,
  columns,
  api,
  backing,
  isSelected,
  isDragging,
  isDragOver,
  editingField,
  editingEventKey,
  enableDrag,
  registerRowRef,
  registerEditor,
  onRowMouseDown,
  onRowClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const id = rowData?.id ?? String(rowIndex);
  const backgroundColor = getHierarchicalBackgroundColor(
    rowData?.effective_type,
    rowData?.hierarchical_index
  );

  const rowStyle: React.CSSProperties = {
    ...(backgroundColor ? { backgroundColor } : {}),
  };

  return (
    <div
      ref={el => registerRowRef(id, el)}
      className={`${styles.row} ${isSelected ? styles.rowSelected : ''} ${
        isDragging ? styles.rowDragging : ''
      } ${isDragOver ? styles.rowDragOver : ''}`}
      style={rowStyle}
      draggable={enableDrag}
      onMouseDown={e => onRowMouseDown(e, rowIndex)}
      onClick={e => onRowClick(e, rowData, rowIndex)}
      onContextMenu={e => onContextMenu(e, rowIndex)}
      onDragStart={e => onDragStart(e, rowIndex)}
      onDragOver={e => onDragOver(e, rowIndex)}
      onDrop={e => onDrop(e, rowIndex)}
      onDragEnd={onDragEnd}
    >
      {columns.map(colDef => (
        <CohortCardCell
          key={colDef.field}
          rowData={rowData}
          rowIndex={rowIndex}
          colDef={colDef}
          api={api}
          backing={backing}
          isEditing={editingField === colDef.field}
          eventKey={editingField === colDef.field ? editingEventKey : undefined}
          registerEditor={registerEditor}
        />
      ))}
    </div>
  );
};
