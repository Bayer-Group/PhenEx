import styles from './TypeCellRenderer.module.css';

const TypeCellRenderer = (props: any) => {
  const type = props.value;
  const colorClass = `rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-outer`;
  return (
    <div className={styles.container}>
      <span
        className={`${styles.block} ${colorClass}`}
        onClick={() => {
          props.api?.startEditingCell({
            rowIndex: props.node.rowIndex,
            colKey: props.column.getColId()
          });
        }}
      >
        {type}
      </span>
    </div>
  );
};

export default TypeCellRenderer;
