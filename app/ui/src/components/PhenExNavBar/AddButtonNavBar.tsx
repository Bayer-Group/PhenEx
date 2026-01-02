import React from 'react';
import styles from './NavBar.module.css';
import { Tabs } from '../ButtonsAndTabs/Tabs/Tabs';

interface AddButtonNavBarProps {
  height: number;
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
}

export const AddButtonNavBar: React.FC<AddButtonNavBarProps> = ({ height, onSectionTabChange, dragHandleRef }) => {

  return (
    <div className={`${styles.navBar} ${styles.navBarAddButton}`} style={{ height: `${height}px` , width: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        className={styles.addButton}
        onClick={() => onSectionTabChange?.(0)}
        title="Add new item"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
};
