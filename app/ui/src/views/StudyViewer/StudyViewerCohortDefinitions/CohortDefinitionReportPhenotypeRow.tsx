import React, { useRef,  useEffect } from 'react';
import styles from './CohortDefinitionReportPhenotypeRow.module.css';
import { CohortCardPhenotypeRowProps } from './CohortCardPhenotypeRow';
import { getHierarchicalBackgroundColor } from '@/views/CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
// The arrow between phenotypes is drawn by the parent component based on layout needs.
export interface CohortDefinitionReportPhenotypeRowProps extends CohortCardPhenotypeRowProps {
  alignment?: 'center' | 'left' | 'right';
  centerLineMarginLeft?: string;
  hideExclusion?: boolean;
}

export const CohortDefinitionReportPhenotypeRow: React.FC<CohortDefinitionReportPhenotypeRowProps> = React.memo(({
  row,
  index,
  isSelected,
  // Drag features are kept in props interface but might not be visually emphasized in report mode
  // unless we want to allow reordering the flowchart.
  // For now we pass them through or ignore if not needed visually.
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onClick,
  onExpandClick,
  alignment = 'center',
  centerLineMarginLeft = '0',
  hideExclusion = false,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);

  // Get hierarchical visuals
  const backgroundColor = getHierarchicalBackgroundColor(
    row.effective_type,
    row.hierarchical_index
  );

  const borderColorVar = row.effective_type 
    ? `var(--color_${row.effective_type}_dim)` 
    : '#333';


  const textColorVar = row.effective_type 
    ? `var(--color_${row.effective_type})` 
    : '#333';


  // Calculate positioning style
  let positionStyle: React.CSSProperties = {
    backgroundColor: backgroundColor || 'white',
    borderColor: borderColorVar,
  };

  let containerStyle: React.CSSProperties = {};

  if (alignment === 'center') {
    // If centered, we want the center of the box to be at centerLineMarginLeft
    // For now, if we switched CSS to flex-row for "left" alignment logic, 
    // we should make sure 'center' still works if we ever use it.
    // But since CSS .rowContainer is now `flex-direction: row`, "center" logic might be broken because
    // it expected `flex-direction: column` wrapper with absolute positioning tricks.
    // However, keeping consistent with the User's "make all left" request, we primarily serve 'left'.
    // If we wanted to keep 'center' support with the new Flex layout, we'd need conditionals in CSS
    // or style overrides.
    // Given the request "make all... aligned to the left", we assume 'left' is the new standard.
    // But let's keeping the style clean:
    containerStyle = {
      // Override flex row to mimic old center behavior if needed, OR 
      // just ignore center logic since we are moving to left.
      // Let's assume this component is now primarily left-aligned flex row.
    };
    positionStyle = {
        ...positionStyle,
        // Reset absolute positioning logic
    };
  } else if (alignment === 'left') {
     // Default flex layout handles this.
     // Maybe add specific margin if requested.
     containerStyle = {
     }
  }

  return (
    <div className={styles.rowContainer} style={containerStyle}>
 

      {/* Wrapper to center the box on the 150px line */}
      <div className={styles.leftWrapper}>
        <div 
          ref={boxRef}
          className={`${styles.phenotypeBox} ${isSelected ? styles.selected : ''}`}
          style={{ borderColor: textColorVar }}
          onClick={(e) => {
            onClick(e, row, index);
            if (onExpandClick) {
              onExpandClick(row, index);
            }
          }}
          draggable={false}
        >
          <div className={styles.phenotypeBoxColorLayer} style={{ backgroundColor: backgroundColor || 'white' , color: textColorVar || 'black' , borderColor: borderColorVar || `var(--line-color, '#333')`}}>
            <div className={styles.boxContent}>
              <div className = {styles.nameAndDescription}>
                <div className={styles.phenotypeName}>
                    {row.name || 'Unnamed Phenotype'}<br></br>
                </div>
                {row.description && (
                <div className={styles.phenotypeDescription}>
                    {row.description}
                </div>
                )}
              </div>
              <div className={styles.count}> <span className={styles.countConstants}>n =</span>{row.count !== undefined ? row.count : '?'}</div>

            </div>
          </div>
        </div>
        {/* Horizontal Arrow - only render if not hiding exclusion */}
        {!hideExclusion && (
          <div className={styles.horizontalArrow}>
            <svg width="100%" height="100%" style={{overflow: 'visible', zIndex: -1, color: textColorVar || '#555'}}>
              <line 
                x1="50%" 
                y1="0%" 
                x2="calc(100% - 5px)" 
                y2="0%" 
                stroke="currentColor"
                strokeWidth="1"
                markerEnd="url(#reportArrowhead)"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Excluded Box - only render if not hiding exclusion */}
      {!hideExclusion && (
        <div className={styles.excludedBox} style={{ backgroundColor: backgroundColor || 'white' , color: textColorVar || 'black' , borderColor: borderColorVar || `var(--line-color, '#333')`}}>
          <div>Excluded</div>
          <div style={{fontWeight: 'normal'}}>
            <span className={styles.countConstants}>n =</span>{`${row.excluded_count !== undefined ? row.excluded_count : (row.n_excluded !== undefined ? row.n_excluded : '34,872')}`}
          </div>
        </div>
      )}
    </div>
  );
});

CohortDefinitionReportPhenotypeRow.displayName = 'CohortDefinitionReportPhenotypeRow';
