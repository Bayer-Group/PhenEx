import React from 'react';
import styles from './NameCellRenderer.module.css';
import { PhenexCellRendererProps, PhenexCellRenderer } from './PhenexCellRenderer';
import { CohortDataService } from '../../CohortDataService/CohortDataService';

import typeStyles from '../../../../styles/study_types.module.css'
import ReactMarkdown from 'react-markdown';
const NameCellRenderer: React.FC<PhenexCellRendererProps> = props => {
  const {
    colorBackground = true,
    colorBorder = true,
  } = props;
  
  const dataService = CohortDataService.getInstance();

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
      <div className={`${styles.label} ${isSelected ? styles.selected : ''} ${fontColor}`} style={getIndentationStyle()}>
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
      showButtons={true}
    >
      {renderNameAndDescription()}
    </PhenexCellRenderer>
  );
};

export default NameCellRenderer;
