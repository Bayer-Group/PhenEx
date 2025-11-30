import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { FilterType } from '../CellEditors/logicalExpressionEditor/types';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { LogicalExpressionRenderer } from './actualRendering/LogicalExpressionRenderer';

const LogicalExpressionCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  // Let PhenexCellRenderer handle missing values - don't return null early
  
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

  // Only render custom content if value is valid, otherwise let PhenexCellRenderer handle it
  const hasValidValue = props.value && typeof props.value === 'object' && !Array.isArray(props.value);

  // Handler for when individual filters are clicked
  const handleFilterClick = (_filter: FilterType, _path: number[]) => {
    // Open the cell editor when a filter is clicked
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };
  console.log("RENDERING A LOGIC CELL")
  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      {hasValidValue ? (
        <LogicalExpressionRenderer
          value={props.value as unknown as FilterType}
          onFilterClick={handleFilterClick}
        />
      ) : null}
    </PhenexCellRenderer>
  );
};

export default LogicalExpressionCellRenderer;
