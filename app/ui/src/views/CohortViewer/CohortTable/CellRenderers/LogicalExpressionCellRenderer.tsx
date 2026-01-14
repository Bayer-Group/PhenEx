import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { FilterType } from '../CellEditors/logicalExpressionEditor/types';
import { createEditHandler, createDeleteHandler, createLogicalExpressionEditHandler } from './cellRendererHandlers';
import { LogicalExpressionRenderer } from './actualRendering/LogicalExpressionRenderer';

const LogicalExpressionCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);
  const handleArrowClick = createLogicalExpressionEditHandler();

  const handleItemClick = (item: any, _index?: number, event?: React.MouseEvent) => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    // Capture click position and store in node data temporarily
    let clickPosition = null;
    if (event) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      clickPosition = { x: rect.left, y: rect.top };
    }
    
    props.node.data._clickedItemIndex = item.index;
    props.node.data._clickedItemPosition = clickPosition;
    
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
        onArrowClick={handleArrowClick}
        showArrow={true}
      />
    </PhenexCellRenderer>
  );
};

export default LogicalExpressionCellRenderer;
