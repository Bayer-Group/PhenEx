import React from 'react';
import editPencilIcon from '../../../../assets/icons/edit-pencil.svg';
import deleteIcon from '../../../../assets/icons/delete.svg';
import styles from './NameCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { CohortDataService } from '../../CohortDataService/CohortDataService';
import { TwoPanelCohortViewerService } from '../../TwoPanelCohortViewer/TwoPanelCohortViewer';

const NameCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const dataService = CohortDataService.getInstance();
  const onClickEdit = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('phenotype', props.data);
    console.log('Edit button clicked for row with ID:', props.data?.id);
  };
  return (
    <div className={styles.container}>
      <span className={styles.label}>{props.value}</span>
      <div>
        <button className={styles.editButton} onClick={onClickEdit}>
          <img src={editPencilIcon} className={styles.editIcon} alt="Edit" />
        </button>
        <button
          className={styles.deleteButton}
          onClick={() => {
            if (props.data?.id) {
              dataService.deletePhenotype(props.data.id);
            }
          }}
        >
          <img src={deleteIcon} className={styles.editIcon} alt="Delete" />
        </button>
      </div>
    </div>
  );
};

export default NameCellRenderer;
