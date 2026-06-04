import React, { useState, useRef } from 'react';
import styles from './InfoPanelButton.module.css';
import { PhenExNavBarTooltip } from '../../PhenExNavBar/PhenExNavBarTooltip';

interface InfoPanelButtonProps {
  tooltipText: string;
  onClick: () => void;
  svg: React.ReactNode;
}

export const InfoPanelButton: React.FC<InfoPanelButtonProps> = ({
  tooltipText,
  onClick,
  svg,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLSpanElement>(null);

  return (
    <div className={styles.buttonContainer}>
      <span
        ref={buttonRef}
        className={styles.button}
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
        {svg}
      </span>

      <PhenExNavBarTooltip
        isVisible={showTooltip}
        anchorElement={buttonRef.current}
        label={tooltipText}
        verticalPosition="below"
        horizontalAlignment="right"
        gap={6}
      />
    </div>
  );
};
