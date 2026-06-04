import { FC, useRef } from 'react';
import styles from './LeftPanel.module.css';
import { UserLogin } from './UserLogin/UserLogin';

interface LeftPanelProps {
  isVisible: boolean;
  width: number;
  children?: React.ReactNode;
  onPathClick?: (event: React.MouseEvent) => void;
  selectedPath?: string;
}

export const LeftPanel: FC<LeftPanelProps> = ({ isVisible, width, children, onPathClick }) => {
  return (
    <div
      className={`${styles.leftPanel} ${isVisible ? styles.visible : styles.hidden}`}
    >
      <div className={styles.controls}>
        <UserLogin />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
