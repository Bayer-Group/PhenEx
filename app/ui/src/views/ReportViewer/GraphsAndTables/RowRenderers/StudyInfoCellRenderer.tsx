import { FC } from 'react';
import styles from './StudyInfoCellRenderer.module.css';

interface StudyInfoCellRendererProps {
  title: string;
  description?: string;
}

export const StudyInfoCellRenderer: FC<StudyInfoCellRendererProps> = ({ title, description }) => {
  return (
    <div className={styles.container}>
      {description && <div className={styles.description} dangerouslySetInnerHTML={{ __html: description }} />}
    </div>
  );
};
