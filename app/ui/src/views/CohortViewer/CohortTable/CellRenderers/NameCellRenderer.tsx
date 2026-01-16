import React from 'react';
import styles from './NameCellRenderer.module.css';
import { PhenexCellRendererProps, PhenexCellRenderer } from './PhenexCellRenderer';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import ArrowIcon from '../../../../assets/icons/arrow-up-right.svg';

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
  
  
  // Use shared handlers to avoid lazy loading delay
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

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
        <div className={`${styles.label} ${isSelected ? styles.selected : ''} ${isViewing ? styles.viewing : (!isSelected ? fontColor : '')}`}>
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
  );
};

export default NameCellRenderer;
