import { FC } from 'react';
import styles from './LeftPanel.module.css';
import { DirectorySelectionButton } from './DirectorySelectionButton/DirectorySelectionButton';

interface LeftPanelProps {
  isVisible: boolean;
  width: number;
  children?: React.ReactNode;
}

export const LeftPanel: FC<LeftPanelProps> = ({ isVisible, width, children }) => {
  return (
    <div
      className={`${styles.leftPanel} ${isVisible ? styles.visible : styles.hidden}`}
      style={{ width: `${width}px` }}
    >
      <img className={styles.image} src="src/assets/phenx_feather.png" alt="logo" />

      <div className={styles.header}>
        <div className={styles.logoText}>PhenEx</div>
        <DirectorySelectionButton />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
