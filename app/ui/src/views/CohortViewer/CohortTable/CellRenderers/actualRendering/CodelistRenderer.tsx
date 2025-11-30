import React from 'react';
import styles from './CodelistRenderer.module.css';
import { ComplexItemRenderer } from './ComplexItemRenderer';

const MAX_CODES_TO_SHOW = 3;

export interface CodelistValue {
  class_name: 'Codelist';
  codelist?: { 
    [key: string]: string[] | any;  // Can be manual codelist dict OR file codelist object
    file_name?: string;
    codelist_name?: string;
    file_id?: string;
    code_column?: string;
    code_type_column?: string;
    codelist_column?: string;
  };
  codelist_type?: string;
  codelist_name?: string;  // Legacy top-level (for backward compatibility)
  file_name?: string;  // Legacy top-level (for backward compatibility)
  use_code_type?: boolean;
  remove_punctuation?: boolean;
}

export interface CodelistRendererProps {
  value: CodelistValue | CodelistValue[] | null | undefined;
  data?: any;
  onClick?: () => void;
  onItemClick?: (item: CodelistValue, index: number) => void; // Callback for clicking individual items in an array
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
  onItemClick,
}) => {
  const renderManualCodelist = (codelist: { [key: string]: string[] }, parentValue: CodelistValue, index: number = 0) => (
    <div key={index} className={styles.codelistContainer}>
      {Object.entries(codelist).map(([codeType, codes], codeIndex) => {
        // Replace underscores with spaces for better readability
        const displayCodeType = codeType.replace(/_/g, ' ');
        
        return (
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
              {displayCodeType}
              {parentValue.use_code_type ? ' (use code type)' : ' (ignore code type)'}
              {parentValue.remove_punctuation ? ' (remove punctuation)' : ''}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderFileCodelist = (codelistValue: CodelistValue, index: number = 0) => {
    // Extract data from either top-level or nested codelist object
    const fileName = codelistValue.file_name || codelistValue.codelist?.file_name;
    const codelistName = codelistValue.codelist_name || codelistValue.codelist?.codelist_name;
    
    // Replace underscores with spaces for better readability
    const displayCodelistName = codelistName?.replace(/_/g, ' ') || 'Unknown codelist';
    const displayFileName = fileName?.replace(/_/g, ' ') || 'Unknown file';
    
    return (
      <div key={index} className={styles.codelistContainer}>
        <div
          className={styles.codeBlock}
          onClick={(e) => {
            // e.stopPropagation();
            if (onClick) {
              onClick();
            }
          }}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
          <div className={styles.codes}>
            <span className={styles.code}>{displayCodelistName}</span>
          </div>
        </div>
      </div>
    );
  };

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
      <ComplexItemRenderer
        items={value}
        renderItem={(codelist, index) => renderSingleCodelist(codelist, index)}
        onItemClick={onItemClick}
        emptyPlaceholder={<div className={styles.missing}></div>}
      />
    );
  }

  if (
    !value ||
    typeof value !== 'object' ||
    (!value.codelist && !value.codelist_type)
  ) {
    return <div className={styles.missing}></div>;
  }

  // Single item - treat as array of one for consistency
  return (
    <ComplexItemRenderer
      items={[value]}
      renderItem={(codelist, index) => renderSingleCodelist(codelist, index)}
      onItemClick={onItemClick}
      emptyPlaceholder={<div className={styles.missing}></div>}
    />
  );
};
