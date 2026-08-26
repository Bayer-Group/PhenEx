import React, { FC } from 'react';
import styles from './GroupCheckbox.module.css';

interface GroupCheckboxProps {
  isSelected: boolean;
  isPartial: boolean;
  onClick: () => void;
}

export const GroupCheckbox: FC<GroupCheckboxProps> = ({ isSelected, isPartial, onClick }) => (
  <div
    className={`${styles.checkbox}${isSelected ? ` ${styles.selected}` : isPartial ? ` ${styles.partial}` : ''}`}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    role="checkbox"
    aria-checked={isSelected ? true : isPartial ? 'mixed' : false}
  />
);
