import React from 'react';
import { PhenexCellRenderer, PhenexCellRendererProps } from '../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
import styles from './PhenotypeParamCellRenderer.module.css';

export interface PhenotypeParamCellRendererProps extends PhenexCellRendererProps {}

export const PhenotypeParamCellRenderer: React.FC<PhenotypeParamCellRendererProps> = props => {
  const onClickInfo = () => {
    console.log('Edit button clicked for row with ID:', props.data);
  };

  console.log("IS IS THE PHENOTYPE RENDERING", props.data)
  return (
    <div className={styles.container}>
      <span className={styles.label}>{props.value?.split('_').join(' ')}</span>
      <button
          className={styles.infoButton}
          onClick={onClickInfo}
        >
          i
          {/* <img src={deleteIcon} className={styles.editIcon} alt="Delete" /> */}
        </button>
    </div>
  );

};

export default PhenotypeParamCellRenderer;