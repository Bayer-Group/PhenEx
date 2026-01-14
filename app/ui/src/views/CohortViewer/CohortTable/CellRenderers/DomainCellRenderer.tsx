import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { DomainRenderer } from './actualRendering/DomainRenderer';

const DomainCellRenderer: React.FC<PhenexCellRendererProps> = props => {
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

  if (props.data.class_name === 'LogicPhenotype') {
  }

  if (props.value === undefined || props.value === null || props.value === 'missing') {
    return (
      <PhenexCellRenderer {...props}>
        <div></div>
      </PhenexCellRenderer>
    );
  }

  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      <DomainRenderer
        value={props.value}
        data={props.data}
        onClick={handleClick}
      />
    </PhenexCellRenderer>
  );
};

export default DomainCellRenderer;
