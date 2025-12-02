import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { FilterType } from '../CellEditors/categoricalFilterEditor/types';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { CategoricalFilterRenderer } from './actualRendering/CategoricalFilterRenderer';

const CategoricalFilterCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      <CategoricalFilterRenderer
        value={props.value as unknown as FilterType}
        data={props.data}
      />
    </PhenexCellRenderer>
  );
};

export default CategoricalFilterCellRenderer;
