import styles from './TypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import typeStyles from '../../../../styles/study_types.module.css';

const TypeCellRenderer = (props: any) => {
  const type = props.value;

  const renderIndex = (phenotype: any) => {
    return <span className={styles.index}>{phenotype.hierarchical_index}</span>;
    if (phenotype.type === 'component' && phenotype.hierarchical_index) {
      // For component phenotypes, show hierarchical index (e.g., "1.2.3")
      return <span className={styles.index}>{phenotype.hierarchical_index}</span>;
    } else {
      // For non-component phenotypes, show regular index (but not for entry)
      return <span className={styles.index}>{phenotype.type != 'entry' ? phenotype.index : ''}</span>;
    }
  };

  const renderComponentDisplay = () => {
    if (props.data.type === 'component') {
      const effectiveType = props.data.effective_type;
      const hierarchicalIndex = props.data.hierarchical_index;
      
      if (hierarchicalIndex) {
        // For other components: show only hierarchical index
        return hierarchicalIndex;
      }
    }
    return `${renderIndex(props.data).props.children}`;
    
    // For non-components: show type + index
    return `${props.data.type === 'component' && props.data.effective_type ? props.data.effective_type : type} ${renderIndex(props.data).props.children}`;
  };

  const renderCount = () => {
    return (
      typeof props.data.count !== 'undefined' && (
        <div className={`${styles.countdiv} ${colorClassText}`}>{props.data.count}</div>
      )
    );
  };

  // Use effective_type for coloring if available, otherwise fall back to type
  const effectiveType = props.data.effective_type || type;
  const colorClassText = `${styles.ancestorLabel} ${typeStyles[`${effectiveType || ''}_text_color`] || ''}`;
  const colorClass = `${styles.ancestorLabel} ${typeStyles[`${effectiveType || ''}_color_block`] || ''}`;

  // Calculate indentation for component phenotypes based on their level
  const getIndentationStyle = () => {
    if (props.data.type === 'component' && props.data.level > 0) {
      return {
        marginLeft: `calc(var(--type-label-indent) * ${props.data.level})`
      };
    }
    return {};
  };

  return (
    <PhenexCellRenderer {...props} showButtons={false}>
      <div className={styles.container} style={getIndentationStyle()}>
        <span
          className={`${styles.block} ${colorClassText}`}
          onClick={() => {
            props.api?.startEditingCell({
              rowIndex: props.node.rowIndex,
              colKey: props.column.getColId(),
            });
          }}
        >
          {renderComponentDisplay()}
        </span>
         {renderCount()}
      </div>
    </PhenexCellRenderer>
  );
};

export default TypeCellRenderer;
