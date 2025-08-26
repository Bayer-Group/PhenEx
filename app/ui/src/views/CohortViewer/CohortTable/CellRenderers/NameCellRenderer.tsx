import React from 'react';
import editPencilIcon from '../../../../assets/icons/edit-pencil.svg';
import moreHorizIcon from '../../../../assets/icons/more-horiz.svg';
import styles from './NameCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';
import { CohortDataService } from '../../CohortDataService/CohortDataService';
import { TwoPanelCohortViewerService } from '../../TwoPanelCohortViewer/TwoPanelCohortViewer';
import { CohortViewType } from '../../TwoPanelCohortViewer/types';
import { SettingsCellEditor } from '../CellEditors/SettingsCellEditor';

import typeStyles from '../../../../styles/study_types.module.css'
const NameCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const dataService = CohortDataService.getInstance();
  const onClickEdit = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('phenotype' as CohortViewType, props.data);
    console.log('Edit button clicked for row with ID:', props.data?.id);
  };

  const onClickDelete = () => {
    if (!props.node || !props.column) return;

    const params = {
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
      key: 'settings',
    };
    props.api.startEditingCell(params);
    console.log('Edit delete clicked for row with ID:', props.data?.id);
  };

  const renderComponentPhenotypeName = () => {
    const parentPhenotype = dataService.getPhenotypeById(props.data.parentIds[0]);
    const parentName = parentPhenotype?.name || props.data.parentIds[0];
    return (
      <div className={styles.label}>
        <span className={`${styles.parentLabel} ${typeStyles[`${parentPhenotype?.type || ''}_text_color`] || ''}`}>
          {parentName}
        </span>
        <span className={styles.parentDivider}>{'|'}</span>
        {props.value}
      </div>
    );
  };

  const renderName = () => {
    const isComponentPhenotype = props.data?.parentIds && props.data.parentIds.length > 0;
    return (
      <div className={styles.label}>
        {isComponentPhenotype 
          ? renderComponentPhenotypeName() 
          : props.value}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {renderName()}

      <div>
        <button className={styles.editButton} onClick={onClickEdit}>
          <img src={editPencilIcon} className={styles.editIcon} alt="Edit" />
        </button>
        <button
          className={styles.deleteButton}
          onClick={() => {
            onClickDelete();
            if (props.data?.id) {
              // dataService.deletePhenotype(props.data.id);
            }
          }}
        >
          <img src={moreHorizIcon} className={styles.editIcon} alt="Delete" />
        </button>
      </div>
    </div>
  );
};

export default NameCellRenderer;
