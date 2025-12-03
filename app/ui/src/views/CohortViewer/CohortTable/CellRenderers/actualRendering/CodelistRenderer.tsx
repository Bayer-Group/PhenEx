import React from 'react';
import styles from './CodelistRenderer.module.css';
import { ComplexItemRenderer } from './ComplexItemRenderer';
import typeStyles from '../../../../../styles/study_types.module.css';

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
  selectedIndex?: number; // Index of the currently selected item (for visual highlighting)
  selectedClassName?: string; // Optional className to apply to the selected item
}

/**
 * CodelistRenderer - Reusable component for rendering codelist values
 * Can be used in both CellRenderers and CellEditors
 * 
 * @param value - The codelist value(s) to render
 * @param data - Row data for accessing effective_type and other row-level properties
 * @param onClick - Optional callback when a codelist is clicked
 */
export const CodelistRenderer: React.FC<CodelistRendererProps> = ({
  value,
  data,
  onClick,
  onItemClick,
  selectedIndex,
  selectedClassName,
}) => {
  const renderManualCodelist = (codelist: { [key: string]: string[] }, parentValue: CodelistValue, index: number = 0) => (
    <div key={index} className={styles.codelistContainer}>
      {Object.entries(codelist).map(([codeType, codes], codeIndex) => {
        // Skip entries that have file metadata properties
        if (codeType === 'file_name' || codeType === 'codelist_name' || codeType === 'file_id' || 
            codeType === 'code_column' || codeType === 'code_type_column' || codeType === 'codelist_column') {
          return null;
        }
        
        // Skip if codes is not an array
        if (!Array.isArray(codes)) {
          return null;
        }
        
        // Replace underscores with spaces for better readability
        const displayCodeType = codeType.replace(/_/g, ' ');
        
        return (
          <div
            key={codeIndex}
            className={styles.codeBlock}
            onClick={(e) => {
              // e.stopPropagation();
              // if (onClick) {
              //   onClick();
              // }
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

  const effectiveType = data?.effective_type;
  console.log("THIS IS THE DATA IN CODELIST RENDERER,", data);
  const colorClass = typeStyles[`${effectiveType || ''}_text_color`] || '';
  const borderColorClass = typeStyles[`${effectiveType || ''}_border_color`] || '';
  console.log("THIS IS THE CODELIST CLOR CL", colorClass);
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
          <div className={`${styles.codes} ${colorClass}`}>
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
      // Check if codelist.codelist exists (nested Codelist structure)
      // This happens when a Codelist object is nested inside another Codelist object
      const actualCodelist = (codelistValue.codelist as any).codelist || codelistValue.codelist;
      return renderManualCodelist(actualCodelist, codelistValue, index);
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
        itemClassName={borderColorClass}
        selectedIndex={selectedIndex}
        selectedClassName={selectedClassName}
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
      itemClassName={borderColorClass}
      selectedIndex={selectedIndex}
      selectedClassName={selectedClassName}
      emptyPlaceholder={<div className={styles.missing}></div>}
    />
  );
};
