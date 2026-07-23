import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { CodelistRenderer } from './actualRendering/CodelistRenderer';
import { CohortDataService } from '../../CohortDataService/CohortDataService';

const CodelistCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

  // Row-level override takes precedence; fall back to global setting
  const rowOverride: boolean | undefined = props.data?.show_full_codelist;
  const showFullCodelist = rowOverride !== undefined
    ? rowOverride
    : CohortDataService.getInstance().getShowFullCodelists();

  const handleClick = () => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  const handleItemClick = (_item: any, _index: number, event?: React.MouseEvent) => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    // Capture click position and store in node data temporarily
    let clickPosition = null;
    if (event) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      clickPosition = { x: rect.left, y: rect.top };
    }
    
    props.node.data._clickedItemIndex = _index;
    props.node.data._clickedItemPosition = clickPosition;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      <CodelistRenderer 
        value={props.value as any} 
        data={props.data}
        onClick={handleClick} 
        onItemClick={handleItemClick}
        showFullCodelist={showFullCodelist}
      />
    </PhenexCellRenderer>
  );
};

export default CodelistCellRenderer;
