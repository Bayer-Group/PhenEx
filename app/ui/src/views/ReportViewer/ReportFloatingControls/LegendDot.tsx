import React, { FC, useRef, useState } from 'react';
import { PhenExNavBarTooltip } from '../../../components/PhenExNavBar/PhenExNavBarTooltip';
import styles from './LegendDot.module.css';

interface LegendDotProps {
  color?: string;
  isActive: boolean;
  onClick: () => void;
  tooltipLabel?: string;
}

export const LegendDot: FC<LegendDotProps> = ({
  color,
  isActive,
  onClick,
  tooltipLabel,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const label = tooltipLabel ?? (isActive ? 'Click to deselect' : 'Click to select');

  return (
    <>
      <div
        ref={ref}
        className={styles.dot}
        style={{
          background: isActive && color ? color : 'transparent',
          border: isActive ? '2px solid transparent' : '2px dashed #ccc',
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
