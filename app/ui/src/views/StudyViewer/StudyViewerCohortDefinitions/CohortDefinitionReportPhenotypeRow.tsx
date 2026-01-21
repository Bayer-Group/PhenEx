import React, { useRef,  useEffect } from 'react';
import styles from './CohortDefinitionReportPhenotypeRow.module.css';
import { CohortCardPhenotypeRowProps } from './CohortCardPhenotypeRow';
import { getHierarchicalBackgroundColor } from '@/views/CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';
// The arrow between phenotypes is drawn by the parent component based on layout needs.
export interface CohortDefinitionReportPhenotypeRowProps extends CohortCardPhenotypeRowProps {
  alignment?: 'center' | 'left' | 'right';
  centerLineMarginLeft?: string;
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
  centerLineMarginLeft = '80%',
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


  // Calculate positioning style
  let positionStyle: React.CSSProperties = {
    backgroundColor: backgroundColor || 'white',
    borderColor: borderColorVar,
  };

  let containerStyle: React.CSSProperties = {};

  if (alignment === 'center') {
    // If centered, we want the center of the box to be at centerLineMarginLeft
    containerStyle = {
      position: 'relative',
    };
    positionStyle = {
        ...positionStyle,
        position: 'relative',
        left: centerLineMarginLeft,
        transform: 'translateX(-50%)',
        marginLeft: 0, // Reset any auto margins
    };
  } else if (alignment === 'left') {
    // Align right side of the box to the center line? Or just standard left align?
    // Based on flowchart images, typically "Main path" is center. "Exclusions" are to the right.
    // If alignment is "left", maybe it means left of the center line? 
    // Let's assume absolute positioning relative to that line for flexibility or just use the line as anchor.
    // For now, simple implementation:
    containerStyle = {
        display: 'flex',
        justifyContent: 'flex-start',
        paddingLeft: '20px'
    }
  } else if (alignment === 'right') {
     // Used for exclusions off the main path
     // Box should be to the right of the center line.
     positionStyle = {
         ...positionStyle,
         position: 'relative',
         left: `calc(${centerLineMarginLeft} + 40px)`, // Offset from center line
         // No translate, so it starts after the offset
     };
  }

  return (
    <div className={styles.rowContainer} style={containerStyle}>
      <div 
        ref={boxRef}
        className={`${styles.phenotypeBox} ${isSelected ? styles.selected : ''}`}
        style={positionStyle}
        onClick={(e) => onClick(e, row, index)}
        draggable={false} // Disable drag for report items usually
      >
        <div className={styles.boxContent}>
            <div className={styles.phenotypeName}>
                {row.name || 'Unnamed Phenotype'}
                {row.count !== undefined && <span style={{fontWeight: 'normal'}}> (n={row.count})</span>}
            </div>
            {row.description && (
            <div className={styles.phenotypeDescription}>
                {row.description}
            </div>
            )}
        </div>
      </div>
    </div>
  );
});

CohortDefinitionReportPhenotypeRow.displayName = 'CohortDefinitionReportPhenotypeRow';
