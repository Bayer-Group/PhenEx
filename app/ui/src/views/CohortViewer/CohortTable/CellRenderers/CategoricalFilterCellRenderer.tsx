import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { FilterType } from '../CellEditors/categoricalFilterEditor/types';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { CategoricalFilterRenderer } from './actualRendering/CategoricalFilterRenderer';

const CategoricalFilterCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

  // Handler for when individual filters are clicked
  const handleFilterClick = (_filter: FilterType, _path: number[]) => {
    // Open the cell editor when a filter is clicked
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      <CategoricalFilterRenderer
        value={props.value as unknown as FilterType}
        onFilterClick={handleFilterClick}
      />
    </PhenexCellRenderer>
  );
};

export default CategoricalFilterCellRenderer;
