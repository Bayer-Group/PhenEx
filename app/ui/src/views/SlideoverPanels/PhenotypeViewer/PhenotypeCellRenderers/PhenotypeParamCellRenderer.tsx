import React, { useState, useRef, useEffect } from 'react';
import {
  PhenexCellRenderer,
  PhenexCellRendererProps,
} from '../../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
import styles from './PhenotypeParamCellRenderer.module.css';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import ReactMarkdown from 'react-markdown';
import { InfoPortal } from '../../../../components/Portal/InfoPortal';
import typeStyles from '../../../../styles/study_types.module.css';

let parametersInfo = JSON.parse(parametersInfoRaw);
export interface PhenotypeParamCellRendererProps extends PhenexCellRendererProps {}

export const PhenotypeParamCellRenderer: React.FC<PhenotypeParamCellRendererProps> = props => {
  const [showInfoPortal, setShowInfoPortal] = useState(false);
  const [portalOpacity, setPortalOpacity] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowInfoPortal(true);
      setTimeout(() => setPortalOpacity(1), 10);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const handleInfoPortalHide = () => {
    setPortalOpacity(0);
    setTimeout(() => setShowInfoPortal(false), 200);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
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

  // Get dynamic text color class based on effective_type
  const effectiveType = props.data?.effective_type || props.data?.type;
  const textColorClass = effectiveType ? typeStyles[`${effectiveType}_text_color`] || '' : '';

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={styles.label}>{formatValue()}</span>
      <button className={styles.infoButton} tabIndex={-1}>i</button>

      {showInfoPortal && (
        <InfoPortal
          triggerRef={containerRef}
          position="below"
          offsetX={0}
          offsetY={-30}
          alignment="right"
          textAlign="left"
          onHideRequest={handleInfoPortalHide}
        >
          <div
            className={styles.infoPortalContainer}
            style={{ opacity: portalOpacity }}
          >
            <span className={styles.infoPortalTitle}>{formatValue()}</span>
            <ReactMarkdown>{fullDescription}</ReactMarkdown>
          </div>
        </InfoPortal>
      )}
    </div>
  );
};



export default PhenotypeParamCellRenderer;
