import React from 'react';
import {
  PhenexCellRenderer,
  PhenexCellRendererProps,
} from '../../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
import styles from './PhenotypeParamCellRenderer.module.css';

export interface PhenotypeParamCellRendererProps extends PhenexCellRendererProps {}

export const PhenotypeParamCellRenderer: React.FC<PhenotypeParamCellRendererProps> = props => {
  const onClickInfo = () => {
    console.log('Edit button clicked for row with ID:', props.data);
  };
  const formatValue = () => {
    if (props.value === 'class_name') {
      return 'phenotype';
    }
    return props.value?.split('_').join(' ');
  };
  return (
    <div className={styles.container}>
      <span className={styles.label}>{formatValue()}</span>
      <button className={styles.infoButton} onClick={onClickInfo}>
        i{/* <img src={deleteIcon} className={styles.editIcon} alt="Delete" /> */}
      </button>
    </div>
  );
};

export default PhenotypeParamCellRenderer;
