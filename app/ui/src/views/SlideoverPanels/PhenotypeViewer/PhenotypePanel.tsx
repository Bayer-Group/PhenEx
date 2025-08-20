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
        <i className = {styles.whiteText}>Edit a single phenotype</i> using this panel. 
        <br></br>
        <ul>
          <li>Phenotypes are editable in the left cohort editing table, or this single phenotype panel.</li>
          <li>
            All parameters available for the phenotype you have selected, in this case <strong>{data?.class_name}</strong>, are displayed and editable in this table.
          </li>
        </ul>
      </span>
    );
  };

  return (
    <SlideoverPanel title="Edit phenotype" info={infoContent()} classNameHeader={typeStyles[`${data.type}_color_block`]} classNameButton={styles.whiteText}>
      <div>
        <PhenotypeViewer data={data} />
      </div>
    </SlideoverPanel>
  );
};
