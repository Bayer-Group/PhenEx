import React, { FC, useRef, useState } from 'react';
import { PhenExNavBarTooltip } from '../../../components/PhenExNavBar/PhenExNavBarTooltip';
import styles from './LegendDot.module.css';

interface LegendDotProps {
  color?: string;
  isActive: boolean;
  partiallyActive?: boolean;
  onClick: () => void;
  tooltipLabel?: string;
  scale?: number;
}

export const LegendDot: FC<LegendDotProps> = ({
  color,
  isActive,
  partiallyActive = false,
  onClick,
  tooltipLabel,
  scale,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const label = tooltipLabel ?? (isActive ? 'Click to deselect' : 'Click to select');

  const getBackground = (): string => {
    if (!color) return 'transparent';
    if (isActive) return color;
    if (partiallyActive) return `linear-gradient(to right, ${color} 50%, transparent 50%)`;
    return 'transparent';
  };

  return (
    <>
      <div
        ref={ref}
        className={styles.dot}
        style={{
          background: getBackground(),
          border: isActive ? '1px solid transparent' : partiallyActive && color ? `1px solid ${color}` : '2px dashed #ccc',
          ...(scale != null ? { transform: `scale(${scale})` } : {}),
        }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <PhenExNavBarTooltip
        isVisible={hovered}
        anchorElement={ref.current}
        label={label}
        verticalPosition="above"
        horizontalAlignment="left"
        delay={400}
      />
    </>
  );
};
