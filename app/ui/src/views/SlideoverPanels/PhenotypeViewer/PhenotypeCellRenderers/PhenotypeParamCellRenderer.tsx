import React, { useState, useRef, useEffect } from 'react';
import {
  PhenexCellRenderer,
  PhenexCellRendererProps,
} from '../../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
import styles from './PhenotypeParamCellRenderer.module.css';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import ReactMarkdown from 'react-markdown';
import { InfoPortal } from '../../../../components/Portal/InfoPortal';
let parametersInfo = JSON.parse(parametersInfoRaw);
export interface PhenotypeParamCellRendererProps extends PhenexCellRendererProps {}

export const PhenotypeParamCellRenderer: React.FC<PhenotypeParamCellRendererProps> = props => {
  const [showInfoPortal, setShowInfoPortal] = useState(false);
  const [portalOpacity, setPortalOpacity] = useState(0);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const onClickInfo = () => {
    console.log('Edit button clicked for row with ID:', props.data);
  };

  const handleInfoButtonMouseEnter = () => {
    // Clear any existing timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Set a delay of 200ms before showing the portal
    timerRef.current = setTimeout(() => {
      setShowInfoPortal(true);
      // Slight delay before starting the fade-in animation
      setTimeout(() => {
        setPortalOpacity(1);
      }, 10);
    }, 200);
  };

  const handleInfoButtonMouseLeave = () => {
    // Clear the timer if the mouse leaves before the delay completes
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleInfoPortalHide = () => {
    // Fade out first
    setPortalOpacity(0);
    // Then hide after transition completes
    setTimeout(() => {
      setShowInfoPortal(false);
    }, 200); // Match this with the transition duration
  };
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const formatValue = () => {
    if (props.value === 'class_name') {
      return 'phenotype';
    }
    return props.value?.split('_').join(' ');
  };


// Helper function to get parameter description
const getParameterDescription = (parameter: string): string => {
  const paramInfo = (parametersInfo as any)[parameter];

  const fullDescription = paramInfo?.description || 'No description available for this parameter.';
  
  // Extract only the first sentence (until the first period)
  const firstSentence = fullDescription.split('.')[0];
  return firstSentence.endsWith('.') ? firstSentence : firstSentence + '.';
};

// Helper function to get full parameter description
const getFullParameterDescription = (parameter: string): string => {
  const paramInfo = (parametersInfo as any)[parameter];
  return paramInfo?.description || 'No description available for this parameter.';
};


  const description = getParameterDescription(props.data.parameter);
  const fullDescription = getFullParameterDescription(props.data.parameter);

  console.log("PARM CELL", props.data.parameter, props)
  return (
    <div className={styles.container}>
      <span className={styles.label}>{formatValue()}</span>
      <br></br>
      <span className={styles.infotext}>
        
        
         <ReactMarkdown 
            components={{
              p: ({children}) => <p style={{marginTop: '5px', padding: '0px'}}>{children}</p>
            }}
          >
            {description}
          </ReactMarkdown>
        
        
        </span>
      <button 
        ref={infoButtonRef}
        className={styles.infoButton} 
        onClick={onClickInfo}
        onMouseEnter={handleInfoButtonMouseEnter}
        onMouseLeave={handleInfoButtonMouseLeave}
      >
        i{/* <img src={deleteIcon} className={styles.editIcon} alt="Delete" /> */}
      </button>
      
      {showInfoPortal && (
        <InfoPortal
          triggerRef={infoButtonRef}
          position="below"
          offsetX={-30}
          offsetY={-30}
          alignment="right"
          onHideRequest={handleInfoPortalHide}
        >
          <div
            style={{
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '12px',
              maxWidth: '300px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontSize: '14px',
              lineHeight: '1.5',
              cursor: 'pointer',
              opacity: portalOpacity,
              // transition: 'opacity 20ms ease-in-out',
            }}
          >
            <ReactMarkdown>{fullDescription}</ReactMarkdown>
          </div>
        </InfoPortal>
      )}
    </div>
  );
};



export default PhenotypeParamCellRenderer;
