import React from 'react';
import styles from './SlideoverPanel.module.css';

interface SlideoverPanelProps {
  title: string;
  children: React.ReactNode;
}

export const SlideoverPanel: React.FC<SlideoverPanelProps> = ({
  title,
  children,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>{title}</div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
