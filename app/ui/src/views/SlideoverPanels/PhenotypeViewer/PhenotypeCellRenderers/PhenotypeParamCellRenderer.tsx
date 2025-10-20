import React from 'react';
import {
  PhenexCellRenderer,
  PhenexCellRendererProps,
} from '../../../CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
import styles from './PhenotypeParamCellRenderer.module.css';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import ReactMarkdown from 'react-markdown';
let parametersInfo = JSON.parse(parametersInfoRaw);
export interface PhenotypeParamCellRendererProps extends PhenexCellRendererProps {}

export const PhenotypeParamCellRenderer: React.FC<PhenotypeParamCellRendererProps> = props => {
  const onClickInfo = () => {
    console.log('Edit button clicked for row with ID:', props.data);
  };
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
  const description = getParameterDescription(props.data.parameter);

  console.log("PARM CELL", props)
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
      <button className={styles.infoButton} onClick={onClickInfo}>
        i{/* <img src={deleteIcon} className={styles.editIcon} alt="Delete" /> */}
      </button>
    </div>
  );
};



export default PhenotypeParamCellRenderer;
