import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './CodelistCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const MAX_CODES_TO_SHOW = 3;

interface CodelistCellRendererProps extends PhenexCellRendererProps {
  value: {
    class_name: 'Codelist';
    codelist: { [key: string]: string[] };
    use_code_type?: boolean;
    remove_punctuation?: boolean;
  };
}

const CodelistCellRenderer: React.FC<CodelistCellRendererProps> = props => {
  if (
    props.data.class_name !== 'CodelistPhenotype' &&
    props.data.class_name !== 'MeasurementPhenotype'
  ) {
    return <div className={styles.notApplicable}>na</div>;
  }

  if (
    !props.value ||
    typeof props.value !== 'object' ||
    !props.value.codelist ||
    typeof props.value.codelist !== 'object' ||
    Object.keys(props.value.codelist).length === 0
  ) {
    return <PhenexCellRenderer {...props}><div className={styles.missing}>Missing</div></PhenexCellRenderer>;

  }

  const codelistContent = (
    <div className={styles.codelistContainer}>
      {Object.entries(props.value.codelist).map(([codeType, codes], index) => (
        <div key={index} className={styles.codeBlock}>
          <div className={styles.codes}>
            {codes.slice(0, MAX_CODES_TO_SHOW).map((code, codeIndex) => (
              <span key={codeIndex} className={styles.code}>
                {code}
              </span>
            ))}
            {codes.length > MAX_CODES_TO_SHOW && <span className={styles.code}>...</span>}
          </div>
          <div className={styles.codeType}>
            {codeType}
            {props.value.use_code_type ? ' (use code type)' : ' (ignore code type)'}
            {props.value.remove_punctuation ? ' (remove_punctuation)' : ''}
          </div>
        </div>
      ))}
    </div>
  );

  return <PhenexCellRenderer {...props}>{codelistContent}</PhenexCellRenderer>;
};

export default CodelistCellRenderer;
