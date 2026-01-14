import React from 'react';
import styles from './SwitchButton.module.css';

export interface SwitchButtonProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  classNameSwitchContainer?: string;
  classNameSwitchBackground?: string;
  classNameSwitchBackgroundSelected?: string;
  classNameSwitch?: string;
  classNameSwitchSelected?: string;
}

export const SwitchButton: React.FC<SwitchButtonProps> = ({
  label,
  value,
  onValueChange,
  classNameSwitchContainer,
  classNameSwitchBackground,
  classNameSwitchBackgroundSelected,
  classNameSwitch,
  classNameSwitchSelected,
}) => {
  const handleClick = () => {
    onValueChange(!value);
  };

  const switchBackgroundClass = value
    ? classNameSwitchBackgroundSelected || styles.switchBackgroundSelected
    : classNameSwitchBackground || styles.switchBackground;

  const switchClass = value
    ? classNameSwitchSelected || styles.switchSelected
    : classNameSwitch || styles.switch;

  return (
    <div className={`${styles.container} ${classNameSwitchContainer || ''}`}>
      <span className={styles.label}>{label}</span>
      <div
        className={`${styles.switchTrack} ${switchBackgroundClass}`}
        onClick={handleClick}
      >
        <div className={`${styles.switchThumb} ${switchClass}`} />
      </div>
    </div>
  );
};
