import { PhenexCellRenderer } from './PhenexCellRenderer';
import { TypeRenderer } from './actualRendering/TypeRenderer';

const TypeCellRenderer = (props: any) => {
  const handleClick = () => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  return (
    <PhenexCellRenderer {...props} showButtons={false}>
      <TypeRenderer
        value={props.value}
        data={props.data}
        onClick={handleClick}
      />
    </PhenexCellRenderer>
  );
};

export default TypeCellRenderer;
