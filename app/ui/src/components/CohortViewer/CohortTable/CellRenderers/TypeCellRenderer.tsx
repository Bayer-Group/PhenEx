import styles from './TypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const TypeCellRenderer = (props: any) => {
  const type = props.value;
  const colorClass = `rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-outer`;
  return (
    <PhenexCellRenderer {...props}>
      <div className={styles.container}>
        <span
          className={`${styles.block} ${colorClass}`}
          onClick={() => {
            props.api?.startEditingCell({
              rowIndex: props.node.rowIndex,
              colKey: props.column.getColId(),
            });
          }}
        >
          {type}
        </span>
      </div>
    </PhenexCellRenderer>
  );
};

export default TypeCellRenderer;
