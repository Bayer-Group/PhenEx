import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { createDeleteHandler } from './cellRendererHandlers';
import { PhenotypeRenderer } from './actualRendering/PhenotypeRenderer';

const PhenotypeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  // Use shared handlers to avoid lazy loading delay
  const handleDelete = createDeleteHandler(props);

  const handleClick = () => {
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex ?? 0,
      colKey: props.column?.getColId() ?? '',
    });
  };

  return (
    <PhenexCellRenderer {...props} showButtons={false}>
      <PhenotypeRenderer
        value={props.value}
        data={props.data}
        onClick={handleClick}
      />
    </PhenexCellRenderer>
  );
};

export default PhenotypeCellRenderer;
