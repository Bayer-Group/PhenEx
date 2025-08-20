import React from 'react';
import styles from './PhenotypePanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import typeStyles from '../../../styles/study_types.module.css'
import { PhenotypeViewer } from './PhenotypeViewer';
import { Phenotype } from './PhenotypeDataService';

interface PhenotypeViewerProps {
  data?: Phenotype;
}

export const PhenotypePanel: React.FC<PhenotypeViewerProps> = ({ data }) => {

  const infoContent = () => {
    return (
      <span className = {styles.whiteText}>
        <i className = {styles.whiteText}>Edit a single phenotype</i>
        <br></br>
        Currently editing : <strong>{data.name}</strong>
        <br></br>
        <ul>
          <li>{data.name} is currently a <strong>{data?.class_name}</strong>.</li>
          <li>
            All parameters available for <strong>{data?.class_name}</strong> are displayed and editable in this table.
          </li>
          <li>Add component phenotypes if necessary</li>
        </ul>
      </span>
    );
  };

  return (
    <SlideoverPanel title="Phenotype Editor" info={infoContent()} classNameHeader={typeStyles[`${data.type}_color_block`]} classNameButton={styles.whiteText}>
      <div>
        <PhenotypeViewer data={data} />
      </div>
    </SlideoverPanel>
  );
};
