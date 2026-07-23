import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import { DateRangeRenderer } from './actualRendering/DateRangeRenderer';

const DateRangeCellRenderer: React.FC<PhenexCellRendererProps> = props => {
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
    if (event) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      props.node.data._clickedItemPosition = { x: rect.left, y: rect.top };
    }
    props.node.data._clickedItemIndex = index;
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  return (
    <PhenexCellRenderer {...props} onEdit={handleEdit} onDelete={handleDelete}>
      <DateRangeRenderer
        value={props.value as any}
        data={props.data}
        onClick={handleClick}
        onItemClick={handleItemClick}
      />
    </PhenexCellRenderer>
  );
};

export default DateRangeCellRenderer;
