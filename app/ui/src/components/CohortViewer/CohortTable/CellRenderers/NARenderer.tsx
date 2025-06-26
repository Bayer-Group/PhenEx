import React from 'react';
import styles from './NARenderer.module.css';

interface NARendererProps {
  value: any;
}

export const NARenderer: React.FC<NARendererProps> = () => {
  return <div className={styles.naContainer}>not applicable</div>;
};