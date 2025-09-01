import styles from './TypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import typeStyles from '../../../../styles/study_types.module.css';

const TypeCellRenderer = (props: any) => {
  const type = props.value;

  const renderIndex = (phenotype: any) => {
    return <span className={styles.index}>{phenotype.type != 'entry' && phenotype.index}</span>;
  };

  const renderCount = () => {
    return (
      props.data.count && (
        <div className={`${styles.countdiv} ${colorClassText}`}>{props.data.count}</div>
      )
    );
  };

  // Use effective_type for coloring if available, otherwise fall back to type
  const effectiveType = props.data.effective_type || type;
  const colorClassText = `${styles.ancestorLabel} ${typeStyles[`${effectiveType || ''}_text_color`] || ''}`;
  const colorClass = `${styles.ancestorLabel} ${typeStyles[`${effectiveType || ''}_color_block`] || ''}`;

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
