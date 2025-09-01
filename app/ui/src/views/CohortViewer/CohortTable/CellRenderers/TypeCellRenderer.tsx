import styles from './TypeCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import typeStyles from '../../../../styles/study_types.module.css';
import { CohortDataService } from '../../CohortDataService/CohortDataService';

const TypeCellRenderer = (props: any) => {
  const type = props.value;

  const renderIndex = phenotype => {
    return <span className={styles.index}>{phenotype.type != 'entry' && phenotype.index}</span>;
  };

  const renderCount = () => {
    return (
      props.data.count && (
        <div className={`${styles.countdiv} ${colorClassText}`}>{props.data.count}</div>
      )
    );
  };

  const colorClassText = `${styles.ancestorLabel} ${typeStyles[`${type || ''}_text_color`] || ''}`

  const dataService = CohortDataService.getInstance();
  const ancestors = dataService.getAllAncestors(props.data);
  console.log("ANCESTOR IS", ancestors[0]?.type, "ALL ANCESTORS:", ancestors.map((a: any) => ({ type: a.type, name: a.name })));

  // For component phenotypes, derive color from the root ancestor's type
  const getEffectiveType = () => {
    if (type === 'component' && ancestors && ancestors.length > 0) {
      // Check both first and last positions to determine which is the root
      const firstAncestor = ancestors[0];
      const lastAncestor = ancestors[ancestors.length - 1];
      
      console.log("First ancestor:", firstAncestor?.type, "Last ancestor:", lastAncestor?.type);
      
      // Return the type from the root ancestor (try both positions)
      // Usually ancestors[0] is the immediate parent and the last one might be the root
      // But let's use the first non-component type we find
      const rootAncestor = ancestors.find((ancestor: any) => ancestor.type !== 'component') || ancestors[0];
      console.log("Using root ancestor type:", rootAncestor?.type);
      
      return rootAncestor?.type || type;
    }
    return type;
  };

  const effectiveType = getEffectiveType();
  const colorClass = `${styles.ancestorLabel} ${typeStyles[`${effectiveType || ''}_color_block`] || ''}`


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
