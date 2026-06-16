import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { NARenderer } from './NARenderer';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { RelativeTimeRangeRenderer } from './actualRendering/RelativeTimeRangeRenderer';

const RelativeTimeRangeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

  const handleClick = () => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  const handleItemClick = (_item: any, index: number, event?: React.MouseEvent) => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    // Capture click position and store in node data temporarily
    let clickPosition = null;
    if (event) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      clickPosition = { x: rect.left, y: rect.top };
    }
    
    props.node.data._clickedItemIndex = index;
    props.node.data._clickedItemPosition = clickPosition;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  if (props.data.type === 'entry') {
    return (
      <PhenexCellRenderer {...props}>
        <NARenderer value={props.value} />
      </PhenexCellRenderer>
    );
  }

  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      <RelativeTimeRangeRenderer 
        value={props.value as any} 
        data={props.data}
        onClick={handleClick} 
        onItemClick={handleItemClick}
      />
    </PhenexCellRenderer>
  );
};

export default RelativeTimeRangeCellRenderer;
