import { FC } from 'react';
import styles from './CohortInfo.module.css';
import { CohortDatabaseSettings } from './CohortDatabaseSettings/CohortDatabaseSettings';
import { CohortTextArea } from './CohortTextArea/CohortTextArea';

interface CohortInfoProps {}

export const CohortInfo: FC<CohortInfoProps> = () => {
  return (
    <div className={styles.cohortInfoContainer}>
      <div className={styles.leftColumn}>
        <div className={styles.moduleContainer}>
          <CohortTextArea />
        </div>
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.moduleContainer}>
          <CohortDatabaseSettings />
        </div>
        <div className={styles.moduleContainer}>
          {/* Right column bottom content */}
        </div>
      </div>
    </div>
  );
};