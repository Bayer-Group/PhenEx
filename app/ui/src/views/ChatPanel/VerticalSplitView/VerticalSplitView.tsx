import React from 'react';
import styles from './VerticalSplitView.module.css';

interface VerticalSplitViewProps {
  children: React.ReactNode[];
}

export const VerticalSplitView: React.FC<VerticalSplitViewProps> = ({ children }) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.top}>{children[0]}</div>
      <div className={styles.bottom}>{children[1]}</div>
    </div>
  );
};
