import React from 'react';
import styles from './CohortCardViewer.module.css';
import { CohortCardCell } from './CohortCardCell';
import { ShimApi, ShimBacking } from './gridApiShim';
import { getHierarchicalBackgroundColor } from '../CohortTable/CellRenderers/PhenexCellRenderer';

type DropOperation = 'reorder' | 'section' | 'component' | 'forbidden';

interface CohortCardRowProps {
  rowData: any;
  rowIndex: number;
  columns: any[];
  api: ShimApi;
  backing: ShimBacking;
  isSelected: boolean;
  isDragging: boolean;
  /** The drop operation this row would resolve to when hovered during a drag, or null. */
  dropOperation: DropOperation | null;
  /** Whether a reorder/section drop inserts before (top line) or after (bottom line) this row. */
  dropPosition: 'before' | 'after' | null;
  /** Descriptive label for the pending drop operation (rendered on the pinned panel only). */
  dropLabel: string | null;
  isBlurred: boolean;
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
  dropOperation,
  dropPosition,
  dropLabel,
  isBlurred,
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

  const after = dropPosition === 'after';
  const dropClass =
    dropOperation === 'section'
      ? after ? styles.rowDropSectionBottom : styles.rowDropSection
      : dropOperation === 'component'
        ? styles.rowDropComponent
        : dropOperation === 'forbidden'
          ? styles.rowDropForbidden
          : dropOperation === 'reorder'
            ? after ? styles.rowDragOverBottom : styles.rowDragOver
            : '';

  return (
    <div
      ref={el => registerRowRef(id, el)}
      className={`${styles.row} ${isSelected ? styles.rowSelected : ''} ${
        isDragging ? styles.rowDragging : ''
      } ${dropClass} ${isBlurred ? styles.rowDimmed : ''}`}
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
      {dropLabel && <span className={styles.dropLabel}>{dropLabel}</span>}
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
