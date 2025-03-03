import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './CodelistCellRenderer.module.css';

interface CodelistCellRendererProps extends ICellRendererParams {
  value: {
    class_name: 'Codelist';
    codelist: { [key: string]: string[] };
  };
}

const CodelistCellRenderer: React.FC<CodelistCellRendererProps> = props => {
  console.log(props.data, 'IN CELL RENDERER');
  // if props.data.class_name not in ['CodelistPhenotype' or 'MeasurementPhenotype']
  if (
    props.data.class_name !== 'CodelistPhenotype' &&
    props.data.class_name !== 'MeasurementPhenotype'
  ) {
    return <div className={styles.notApplicable}>na</div>;
  }

  if (
    !props.value || 
    typeof props.value !== 'object' ||
    !props.value.codelist || typeof props.value.codelist !== 'object' ||
    Object.keys(props.value.codelist).length === 0
  ) {
    return <div className={styles.missing}>Missing</div>;
  }
  return (
    <div className={styles.codelistContainer}>
      {Object.entries(props.value.codelist).map(([codeType, codes], index) => (
        <div key={index} className={styles.codeBlock}>
          <div className={styles.codes}>
            {codes.map((code, codeIndex) => (
              <span key={codeIndex} className={styles.code}>
                {code}
              </span>
            ))}
          </div>
          <div className={styles.codeType}>{codeType}</div>
        </div>
      ))}
    </div>
  );
};

export default CodelistCellRenderer;
