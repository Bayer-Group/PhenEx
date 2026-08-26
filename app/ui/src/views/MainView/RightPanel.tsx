import { FC, ReactNode } from 'react';
import styles from './RightPanel.module.css';

interface RightPanelProps {
  children?: ReactNode;
}

export const RightPanel: FC<RightPanelProps> = ({ children }) => {
  return (
    <div className={styles.rightPanel}>
      <div className={styles.rightPanelCard}>{children}</div>
    </div>
  );
};
