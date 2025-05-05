import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './CodelistCellRenderer.module.css';
import { PhenexCellRenderer, PhenexCellRendererProps } from './PhenexCellRenderer';

const MAX_CODES_TO_SHOW = 3;

interface CodelistCellRendererProps extends PhenexCellRendererProps {
  value: {
    class_name: 'Codelist';
    codelist: { [key: string]: string[] } | Array<{ [key: string]: string[] }>;
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
  if (Array.isArray(props.value) || (props.value?.codelist_type)) {
    // if the codelist is an array, it's a list of codelists; we do want to render
  } else if (
    !props.value ||
    typeof props.value !== 'object' ||
    !props.value.codelist ||
    typeof props.value.codelist !== 'object' ||
    Object.keys(props.value.codelist).length === 0
  ) {
    return (
      <PhenexCellRenderer {...props}>
        <div className={styles.missing}></div>
      </PhenexCellRenderer>
    );
  }

  const renderManualCodelist = (codelist: { [key: string]: string[] }, index: number = 0) => (
    <div key={index} className={styles.codelistContainer}>
      {Object.entries(codelist).map(([codeType, codes], codeIndex) => (
        <div
          key={codeIndex}
          className={styles.codeBlock}
          className={styles.codeBlock}
          onClick={() => {
            props.api?.startEditingCell({
              rowIndex: props.node.rowIndex,
              colKey: props.column.getColId(),
            });
          }}
        >
          <div className={styles.codes}>
            {codes.slice(0, MAX_CODES_TO_SHOW).map((code, i) => (
              <span key={i} className={styles.code}>
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

  const renderFileCodelist = (value: any, index: number = 0) => (
    <div key={index} className={styles.codelistContainer}>
      <div
        className={styles.codeBlock}
        onClick={() => {
          props.api?.startEditingCell({
            rowIndex: props.node.rowIndex,
            colKey: props.column.getColId(),
          });
        }}
      >
        <div className={styles.codes}>
          <span className={styles.code}>{value.codelist_name}</span>
        </div>
        <div className={styles.codeType}>{value.file_name}</div>
      </div>
    </div>
  );

  const renderSingleCodelist = (value: any, index: number = 0) => {
    if (value.codelist_type === 'from file') {
      return renderFileCodelist(value, index);
    }
    return renderManualCodelist(value.codelist, index);
  };

  const codelistContent = Array.isArray(props.value)
    ? props.value.map((codelist, index) => renderSingleCodelist(codelist, index))
    : renderSingleCodelist(props.value);
  return <PhenexCellRenderer {...props}>{codelistContent}</PhenexCellRenderer>;
};

export default CodelistCellRenderer;
