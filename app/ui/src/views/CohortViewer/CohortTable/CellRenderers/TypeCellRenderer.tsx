import styles from './TypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const TypeCellRenderer = (props: any) => {
  const type = props.value;

  const renderIndex = (phenotype) => {
    return (
      <span className = {styles.index}>
        {phenotype.type != 'entry' && phenotype.index}
      </span>
    );
  }

  const renderCount = () => {
    return props.data.count && <div className={`${styles.countdiv} ${colorClassText}`}>
       {props.data.count}
    </div>;
  };
  const colorClassText = `rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-text`;
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
          {renderIndex(props.data)}
        </span>
       {renderCount()}
      </div>
    </PhenexCellRenderer>
  );
};

export default TypeCellRenderer;
