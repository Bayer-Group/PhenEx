import React, { useRef, useState, useEffect } from 'react';
import { Portal } from '../Portal/Portal';
import styles from './PhenExNavBarTooltip.module.css';

export interface PhenExNavBarTooltipProps {
  isVisible: boolean;
  anchorElement?: HTMLElement | null;
  label: string;
  verticalPosition?: 'above' | 'below';
  horizontalAlignment?: 'left' | 'center' | 'right';
  gap?: number;
  delay?: number; // ms to wait before showing; if user leaves before delay fires, tooltip never appears
}

export const PhenExNavBarTooltip: React.FC<PhenExNavBarTooltipProps> = ({
  isVisible,
  anchorElement,
  label,
  verticalPosition = 'above',
  horizontalAlignment = 'center',
  gap = 0, // Changed from 10 to 0 so the mouse doesn't fall into a gap
  delay,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [delayedVisible, setDelayedVisible] = useState(false);

  useEffect(() => {
    if (!delay) {
      setDelayedVisible(isVisible);
      return;
    }
    if (isVisible) {
      const timer = setTimeout(() => setDelayedVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setDelayedVisible(false);
    }
  }, [isVisible, delay]);

  const visible = delay != null ? delayedVisible : isVisible;

  if (!visible || !label) return null;

  // Calculate position relative to anchor element
  const getTooltipPosition = () => {
    if (!anchorElement) return {};
    
    const rect = anchorElement.getBoundingClientRect();
    const style: React.CSSProperties = {
      position: 'fixed' as const,
    };

    // Vertical positioning
    if (verticalPosition === 'above') {
      style.bottom = `${window.innerHeight - rect.top + gap}px`;
    } else {
      style.top = `${rect.bottom + gap}px`;
    }

    // Horizontal positioning
    if (horizontalAlignment === 'center') {
      style.left = `${rect.left + rect.width / 2}px`;
      style.transform = 'translateX(-50%)';
    } else if (horizontalAlignment === 'left') {
      style.left = `${rect.left}px`;
    } else {
      style.left = `${rect.right}px`;
      style.transform = 'translateX(-100%)';
    }

    return style;
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
