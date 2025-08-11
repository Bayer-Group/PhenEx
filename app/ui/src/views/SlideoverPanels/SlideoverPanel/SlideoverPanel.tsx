import React from 'react';
import styles from './SlideoverPanel.module.css';

interface SlideoverPanelProps {
  title: string;
  info: string | undefined;
  children: React.ReactNode;
}

export const SlideoverPanel: React.FC<SlideoverPanelProps> = ({ title, info='', children }) => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>{title}</div>
      <div className={styles.infobox}>{info}</div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
