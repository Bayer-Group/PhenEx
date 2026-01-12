import React, { useRef } from 'react';
import { Portal } from '../Portal/Portal';
import styles from './PhenExNavBarTooltip.module.css';

export interface PhenExNavBarTooltipProps {
  isVisible: boolean;
  anchorElement?: HTMLElement | null;
  label: string;
}

export const PhenExNavBarTooltip: React.FC<PhenExNavBarTooltipProps> = ({
  isVisible,
  anchorElement,
  label,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  if (!isVisible || !label) return null;

  // Calculate position relative to anchor element
  const getTooltipPosition = () => {
    if (!anchorElement) return {};
    
    const rect = anchorElement.getBoundingClientRect();
    return {
      position: 'fixed' as const,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translateX(-50%)',
      bottom: `${window.innerHeight - rect.top + 15}px`, // 15px gap above the target
    };
  };

  return (
    <Portal>
      <div
        ref={tooltipRef}
        className={styles.tooltip}
        style={getTooltipPosition()}
      >
        {label}
      </div>
    </Portal>
  );
};
