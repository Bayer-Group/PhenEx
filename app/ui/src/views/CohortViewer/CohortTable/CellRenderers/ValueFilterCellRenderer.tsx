import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { ValueFilterRenderer } from './actualRendering/ValueFilterRenderer';

const ValueFilterCellRenderer: React.FC<PhenexCellRendererProps> = props => {
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

  const handleItemClick = (_item: any, _index: number) => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      <ValueFilterRenderer 
        value={props.value as any} 
        data={props.data}
        onClick={handleClick} 
        onItemClick={handleItemClick}
      />
    </PhenexCellRenderer>
  );
};

export default ValueFilterCellRenderer;
