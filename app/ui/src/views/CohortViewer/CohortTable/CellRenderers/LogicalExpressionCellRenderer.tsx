import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { FilterType } from '../CellEditors/logicalExpressionEditor/types';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { LogicalExpressionRenderer } from './actualRendering/LogicalExpressionRenderer';

const LogicalExpressionCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

  const handleItemClick = (item: any) => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    // Store clicked index in node data temporarily
    props.node.data._clickedItemIndex = item.index;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      <LogicalExpressionRenderer
        value={props.value as unknown as FilterType}
        data={props.data}
        onItemClick={handleItemClick}
      />
    </PhenexCellRenderer>
  );
};

export default LogicalExpressionCellRenderer;
