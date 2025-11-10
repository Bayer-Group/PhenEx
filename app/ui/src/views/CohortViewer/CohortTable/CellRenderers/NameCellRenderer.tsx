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
import ReactMarkdown from 'react-markdown';
const NameCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const dataService = CohortDataService.getInstance();
  const onClickEdit = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('phenotype' as CohortViewType, props.data);
  };

  const onClickDelete = () => {
    if (!props.node || !props.column) return;

    const params = {
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
      key: 'settings',
    };
    props.api.startEditingCell(params);
  };

  const renderComponentPhenotypeName = () => {
    const ancestors = dataService.getAllAncestors(props.data);
    return (
      <div className={styles.componentPhenotypeLabel}>
        <div className={styles.ancestorsLabel}>
          {ancestors.map((ancestor, index) => (
            <React.Fragment key={ancestor.id}>
              <span className={`${styles.ancestorLabel} ${typeStyles[`${ancestor.type || ''}_text_color`] || ''}`}>
                {ancestor.name || ancestor.id}
              </span>
              {index < ancestors.length - 1 && (
                <span className={styles.ancestorDivider}>{'|'}</span>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className={styles.componentPhenotypeName}>
          {props.value}
        </div>
      </div>
    );
  };

  const renderName = () => {
    const isComponentPhenotype = props.data?.parentIds && props.data.parentIds.length > 0;
    const isSelected = props.node.isSelected();
    
    
    // Calculate indentation for component phenotypes based on their level
    const getIndentationStyle = () => {
      if (props.data?.type === 'component' && props.data.level > 0) {
        return {
          marginLeft: `calc(var(--type-label-indent) * ${props.data.level})`
        };
      }
      return {};
    };
    
    return (
      <div className={`${styles.label} ${isSelected ? styles.selected : ''}`} style={getIndentationStyle()}>
        {props.value}
        {/* {isComponentPhenotype
          ? renderComponentPhenotypeName()
          : props.value} */}
      </div>
    );
  }

  const renderNameAndDescription = () => {

    const isComponentPhenotype = props.data?.parentIds && props.data.parentIds.length > 0;
    const isSelected = props.node.isSelected();
    
    
    // Calculate indentation for component phenotypes based on their level
    const getIndentationStyle = () => {
      if (props.data?.type === 'component' && props.data.level > 0) {
        return {
          marginLeft: `calc(var(--type-label-indent) * ${props.data.level})`
        };
      }
      return {};
    };

    return (
      <div className={`${styles.label} ${isSelected ? styles.selected : ''}`} style={getIndentationStyle()}>
        {props.value}

        <br></br>
        <span className={styles.infotext} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
          
          
          <ReactMarkdown 
              components={{
                p: ({children}) => <p style={{
                  marginTop: '5px', 
                  padding: '0px', 
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  maxWidth: '100%'
                }}>{children}</p>
              }}
            >
              {props.data.description}
            </ReactMarkdown>
          
          
          </span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {renderNameAndDescription()}

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
