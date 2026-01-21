import React from 'react';
import styles from './CohortCardLightWeight.module.css';
import { CohortCardPhenotypeRow } from './CohortCardPhenotypeRow';

interface CohortDefinitionProps {
  rows: any[];
  cohortId: string;
  selectedRows: Set<number>;
  draggedRowIndex: number | null;
  dragOverRowIndex: number | null;
  isViewportDragging: boolean;
  onRowDragStart: (e: React.DragEvent, rowIndex: number) => void;
  onRowDragOver: (e: React.DragEvent, rowIndex: number) => void;
  onRowDrop: (e: React.DragEvent) => Promise<void>;
  onRowClick: (e: React.MouseEvent, row: any, rowIndex: number) => void;
  onRowEdit: (row: any) => void;
  onContextMenu: (e: React.MouseEvent, rowIndex: number) => void;
  onCellValueChanged: (cohortId: string, rowIndex: number, field: string, value: any) => Promise<void>;
}

export const CohortDefinition: React.FC<CohortDefinitionProps> = ({
  rows,
  cohortId,
  selectedRows,
  draggedRowIndex,
  dragOverRowIndex,
  isViewportDragging,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onRowClick,
  onRowEdit,
  onContextMenu,
  onCellValueChanged,
}) => {
  return (
    <div className={styles.phenotypeList}>
      {rows.map((row, index) => (
        <div
          key={row.id || index}
          onContextMenu={(e) => onContextMenu(e, index)}
        >
          <CohortCardPhenotypeRow
            row={row}
            index={index}
            isSelected={selectedRows.has(index)}
            isDragging={draggedRowIndex === index}
            isDragOver={dragOverRowIndex === index}
            isViewportDragging={isViewportDragging}
            onDragStart={onRowDragStart}
            onDragOver={onRowDragOver}
            onDrop={onRowDrop}
            onClick={onRowClick}
            onExpandClick={(e) => {
              e.stopPropagation();
              onRowEdit(row);
            }}
            onCellValueChanged={async (rowIndex, field, value) => {
              await onCellValueChanged(cohortId, rowIndex, field, value);
            }}
          />
        </div>
      ))}
    </div>
  );
};
