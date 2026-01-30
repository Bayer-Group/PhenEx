import React, { useState, useRef } from 'react';
import styles from './SwitchButton.module.css';
import { PhenExNavBarTooltip } from '../../PhenExNavBar/PhenExNavBarTooltip';

export interface SwitchButtonProps {
  label: string;
  value: boolean;
  onValueChange?: (value: boolean) => void;
  tooltip?: string;
  classNameSwitchContainer?: string;
  classNameSwitchBackground?: string;
  classNameSwitchBackgroundSelected?: string;
  classNameSwitch?: string;
  classNameSwitchSelected?: string;
  verticalPosition?: 'above' | 'below';
}

export const SwitchButton: React.FC<SwitchButtonProps> = ({
  label,
  value,
  onValueChange,
  tooltip,
  classNameSwitchContainer,
  classNameSwitchBackground,
  classNameSwitchBackgroundSelected,
  classNameSwitch,
  classNameSwitchSelected,
  verticalPosition = 'above',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    onValueChange?.(!value);
  };

  const switchBackgroundClass = value
    ? `${styles.switchBackgroundSelected} ${classNameSwitchBackgroundSelected || ''}`
    : `${styles.switchBackground} ${classNameSwitchBackground || ''}`;

  const switchClass = value
    ? `${styles.switchSelected} ${classNameSwitchSelected || ''}`
    : `${styles.switch} ${classNameSwitch || ''}`;

  return (
    <>
      <div 
        ref={containerRef}
        className={`${styles.container} ${classNameSwitchContainer || ''}`}
        onMouseEnter={() => tooltip && setShowTooltip(true)}
        onMouseLeave={() => tooltip && setShowTooltip(false)}
      >
        <span className={styles.label}>{label}</span>
        <div
          className={`${styles.switchTrack} ${switchBackgroundClass}`}
          onClick={handleClick}
        >
          <div className={`${styles.switchThumb} ${switchClass}`} />
        </div>
      </div>
      
      {tooltip && (
        <PhenExNavBarTooltip
          isVisible={showTooltip}
          anchorElement={containerRef.current}
          label={tooltip}
          verticalPosition={verticalPosition}
        />
      )}
    </>
  );
};
