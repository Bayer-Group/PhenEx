import React, { useState, useRef } from 'react';
import styles from './TreeNodeAddButton.module.css';
import { PhenExNavBarTooltip } from '../../PhenExNavBar/PhenExNavBarTooltip';

interface TreeNodeAddButtonProps {
  tooltipText: string;
  onClick: () => void;
}

export const TreeNodeAddButton: React.FC<TreeNodeAddButtonProps> = ({ 
  tooltipText, 
  onClick
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLSpanElement>(null);

  return (
    <div className={styles.buttonContainer}>
      <span
        ref={buttonRef}
        className={styles.addButton}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }
        }}
      >
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      
      <PhenExNavBarTooltip
        isVisible={showTooltip}
        anchorElement={buttonRef.current}
        label={tooltipText}
        verticalPosition="below"
        horizontalAlignment="left"
        gap={6}
      />
    </div>
  );
};
