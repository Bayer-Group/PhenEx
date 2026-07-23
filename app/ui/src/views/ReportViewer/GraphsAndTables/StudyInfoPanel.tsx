import { FC } from 'react';
import styles from './StudyInfoPanel.module.css';

interface StudyInfoPanelProps {
  title: string;
  description?: string;
}

export const StudyInfoPanel: FC<StudyInfoPanelProps> = ({ title, description }) => {
  return (
    <div className={styles.panel}>
      <h1 className={styles.title}>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
};
