import React from 'react';
import styles from './CohortDefinitionReport.module.css';
import { CohortDefinitionReportPhenotypeRow } from './CohortDefinitionReportPhenotypeRow';

interface CohortDefinitionReportProps {
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

export const CohortDefinitionReport: React.FC<CohortDefinitionReportProps> = ({
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
    <div className={styles.reportContainer} style={{ color: 'var(--text-color)' }}>
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker
            id="reportArrowhead"
            markerWidth="16"
            markerHeight="16"
            refX="7"
            refY="7"
            orient="auto"
            markerUnits="userSpaceOnUse"
            stroke="currentColor"
          >
            <polyline points="1 1, 7 7, 1 13" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
        </defs>
      </svg>
      <div className={styles.rowsContainer}>
        {/* First row: Total database size */}
        <React.Fragment key="first-row">
          <div>
            <CohortDefinitionReportPhenotypeRow
              row={{ name: 'Total Database Size', count: rows[0]?.count, effective_type: 'database', hierarchical_index: 0 }}
              index={-1}
              isSelected={false}
              isDragging={false}
              isDragOver={false}
              isViewportDragging={false}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={async () => {}}
              onClick={() => {}}
              onExpandClick={() => {}}
              alignment="left"
              centerLineMarginLeft="50%"
              hideExclusion={true}
            />
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-start',
            paddingLeft: '110px', /* Centered at 120px, -10px for half arrow width */
            height: '40px', 
            alignItems: 'center',
            position: 'relative'
          }}>
            <svg width="20" height="40" style={{overflow:'visible', color: '#555'}}>
              <line 
                x1="10" 
                y1="0" 
                x2="10" 
                y2="35" 
                stroke="currentColor" 
                strokeWidth="1"
                markerEnd="url(#reportArrowhead)"
              />
            </svg>
          </div>
        </React.Fragment>

        {rows.map((row, index) => (
          <React.Fragment key={row.id || index}>
            <div onContextMenu={(e) => onContextMenu(e, index)}>
              <CohortDefinitionReportPhenotypeRow
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
                alignment="left"
                centerLineMarginLeft="50%" // Ignored for alignment=left with new flex implementation
              />
            </div>
            {index < rows.length - 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-start',
                paddingLeft: '110px', /* Centered at 120px, -10px for half arrow width */
                height: '40px', 
                alignItems: 'center',
                position: 'relative'
              }}>
                {/* Vertical arrow */}
                <svg width="20" height="40" style={{overflow:'visible', color: row.effective_type ? `var(--color_${row.effective_type})` : '#555'}}>
                   <line 
                     x1="10" 
                     y1="0" 
                     x2="10" 
                     y2="35" 
                     stroke="currentColor"
                     strokeWidth="1"
                     markerEnd="url(#reportArrowhead)"
                   />
                </svg>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Last row: Final cohort size */}
        {rows.length > 0 && (
          <React.Fragment key="last-row">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-start',
              paddingLeft: '110px', /* Centered at 120px, -10px for half arrow width */
              height: '40px', 
              alignItems: 'center',
              position: 'relative'
            }}>
              <svg width="20" height="40" style={{overflow:'visible', color: '#555'}}>
                <line 
                  x1="10" 
                  y1="0" 
                  x2="10" 
                  y2="35" 
                  stroke="currentColor" 
                  strokeWidth="1"
                  markerEnd="url(#reportArrowhead)"
                />
              </svg>
            </div>
            <div>
              <CohortDefinitionReportPhenotypeRow
                row={{ name: 'Final Cohort Size', count: rows[rows.length - 1]?.count, effective_type: 'cohort', hierarchical_index: 0 }}
                index={rows.length}
                isSelected={false}
                isDragging={false}
                isDragOver={false}
                isViewportDragging={false}
                onDragStart={() => {}}
                onDragOver={() => {}}
                onDrop={async () => {}}
                onClick={() => {}}
                onExpandClick={() => {}}
                alignment="left"
                centerLineMarginLeft="50%"
                hideExclusion={true}
              />
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
};
