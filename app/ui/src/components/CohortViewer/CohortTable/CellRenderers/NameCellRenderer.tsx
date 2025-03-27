import React from 'react';
import editPencilIcon from '../../../../assets/icons/edit-pencil.svg';
import deleteIcon from '../../../../assets/icons/delete.svg';
import styles from './NameCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { CohortDataService } from '../../CohortDataService';

const NameCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const dataService = CohortDataService.getInstance();

  return (
    <PhenexCellRenderer {...props}>
      <span className={styles.label}>{props.value}</span>
      <div>
        {/* <button
          className={styles.editButton}
          onClick={() =>
            props.api.startEditingCell({
              rowIndex: props.rowIndex,
              colKey: props.column.getColId(),
            })
          }
        >
          <img src={editPencilIcon} className={styles.editIcon} alt="Edit" />
        </button> */}
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
    </PhenexCellRenderer>
  );
};

export default NameCellRenderer;
