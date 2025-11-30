import React from 'react';
import styles from '../CodelistCellRenderer.module.css';

const MAX_CODES_TO_SHOW = 3;

export interface CodelistValue {
  class_name: 'Codelist';
  codelist?: { [key: string]: string[] };
  codelist_type?: string;
  codelist_name?: string;
  file_name?: string;
  use_code_type?: boolean;
  remove_punctuation?: boolean;
}

export interface CodelistRendererProps {
  value: CodelistValue | CodelistValue[] | null | undefined;
  onClick?: () => void;
}

/**
 * CodelistRenderer - Reusable component for rendering codelist values
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The codelist value(s) to render
 * @param onClick - Optional callback when a codelist is clicked
 */
export const CodelistRenderer: React.FC<CodelistRendererProps> = ({
  value,
  onClick,
}) => {
  const renderManualCodelist = (codelist: { [key: string]: string[] }, parentValue: CodelistValue, index: number = 0) => (
    <div key={index} className={styles.codelistContainer}>
      {Object.entries(codelist).map(([codeType, codes], codeIndex) => (
        <div
          key={codeIndex}
          className={styles.codeBlock}
          onClick={(e) => {
            e.stopPropagation();
            if (onClick) {
              onClick();
            }
          }}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
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
            {parentValue.use_code_type ? ' (use code type)' : ' (ignore code type)'}
            {parentValue.remove_punctuation ? ' (remove_punctuation)' : ''}
          </div>
        </div>
      ))}
    </div>
  );

  const renderFileCodelist = (codelistValue: CodelistValue, index: number = 0) => (
    <div key={index} className={styles.codelistContainer}>
      <div
        className={styles.codeBlock}
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) {
            onClick();
          }
        }}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <div className={styles.codes}>
          <span className={styles.code}>{codelistValue.codelist_name}</span>
        </div>
        <div className={styles.codeType}>{codelistValue.file_name}</div>
      </div>
    </div>
  );

  const renderSingleCodelist = (codelistValue: CodelistValue, index: number = 0) => {
    if (codelistValue.codelist_type === 'from file') {
      return renderFileCodelist(codelistValue, index);
    }
    if (codelistValue.codelist) {
      return renderManualCodelist(codelistValue.codelist, codelistValue, index);
    }
    return null;
  };

  if (Array.isArray(value)) {
    // If the codelist is an array, it's a list of codelists
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}>
        {value.map((codelist, index) => renderSingleCodelist(codelist, index))}
      </div>
    );
  }

  if (
    !value ||
    typeof value !== 'object' ||
    (!value.codelist && !value.codelist_type)
  ) {
    return <div className={styles.missing}></div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}>
      {renderSingleCodelist(value)}
    </div>
  );
};
