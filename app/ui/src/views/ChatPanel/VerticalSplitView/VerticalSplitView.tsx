import React from 'react';
import styles from './VerticalSplitView.module.css';

interface VerticalSplitViewProps {
  children: React.ReactNode[];
  userHasInteracted?: boolean;
}

export const VerticalSplitView: React.FC<VerticalSplitViewProps> = ({ 
  children, 
  userHasInteracted = false 
}) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.top}>{children[0]}</div>
      <div className={`${styles.bottom} ${userHasInteracted ? styles.experienced : styles.firstTimeUser}`}>
        {children[1]}
      </div>
    </div>
  );
};
