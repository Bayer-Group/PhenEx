import React, { useState } from 'react';
import styles from './NameCellRenderer.module.css';
import { PhenexCellRendererProps, PhenexCellRenderer } from './PhenexCellRenderer';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import ArrowIcon from '../../../../assets/icons/arrow-up-right.svg';
import { CohortDataService } from "../../CohortDataService/CohortDataService";
import { DeleteConfirmModal } from '../../../../components/DeleteConfirmModal/DeleteConfirmModal';

import typeStyles from '../../../../styles/study_types.module.css'
import ReactMarkdown from 'react-markdown';

/**
 * Render the expand arrow icon with proper CSS states
 * States: default, row hovered, self hovered
 */
const renderExpandArrow = (onClick?: (e: React.MouseEvent) => void, className?: string) => {
  return (
    <img
      src={ArrowIcon}
      alt="Expand"
      className={`${styles.expandArrow} ${className || ''}`}
      onClick={onClick}
    />
  );
};
const NameCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const {
    colorBackground = true,
    colorBorder = true,
  } = props;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

  const handleDirectDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!props.data?.id) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    CohortDataService.getInstance().deletePhenotype(props.data.id);
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
    const isViewing = props.data?.isViewing || false; // TODO: determine viewing state from data service/MainViewService
    
    
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
      <div className={styles.labelContainer} style={getIndentationStyle()}>
        {/* <div className={`${styles.label} ${isSelected ? styles.selected : ''} ${isViewing ? styles.viewing : (!isSelected ? fontColor : '')}`}> */}
        <div className={`${styles.label}`}>

          {props.value}
          <span className={`${styles.infotext} ${fontColor}`} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
            <ReactMarkdown 
                components={{
                  p: ({children}) => <p style={{
                    marginTop: '0px', 
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
        <button
          className={styles.deleteButton}
          onClick={handleDirectDelete}
          title="Delete phenotype"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
        {renderExpandArrow((e) => {
          e.stopPropagation();
          handleEdit();
        }, isSelected ? styles.selected : undefined)}
      </div>
    );
  }

  // Check if data has explicit color properties (override component props)
  const shouldColorBackground = props.data?.colorCellBackground !== undefined 
    ? props.data.colorCellBackground 
    : colorBackground;
  
  const shouldColorBorder = props.data?.colorCellBorder !== undefined 
    ? props.data.colorCellBorder 
    : colorBorder;

  const fontColor = typeStyles[`${props.data.effective_type}_text_color`] || ''

  return (
    <>
      <PhenexCellRenderer
        {...props}
        colorBackground={shouldColorBackground}
        colorBorder={shouldColorBorder}
        showButtons={false}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {renderNameAndDescription()}
      </PhenexCellRenderer>
      {showDeleteModal && (
        <DeleteConfirmModal
          name={props.data?.name || ''}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
};

export default NameCellRenderer;
