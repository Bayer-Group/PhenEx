import { FC } from 'react';
import styles from './CohortInfo.module.css';
import { CohortTextArea } from './CohortTextArea/CohortTextArea';
import { CohortInfoAccordianDisplayView } from './CohortInfoAccordianDisplay/CohortInfoAccordianDisplay';

interface CohortInfoProps {}

export const CohortInfo: FC<CohortInfoProps> = () => {
  return (
    <div className={styles.cohortInfoContainer}>
      <div className={styles.top}>
        <CohortInfoAccordianDisplayView
          title="Cohort Info"
          infoContent={
            <div>
              <p>
                Define how you want to characterize your population at index date. To do this first
                define a baseline period; the default is one year running up to the index date,
                inclusive, but modify as necessary.
              </p>
              <p>
                Speed up your work by selecting one or all of our pre-defined phenotype libraries,
                and add and adjust as necessary.
              </p>
            </div>
          }
        />
      </div>
      <div className={styles.bottom}>
        <CohortTextArea />
      </div>
    </div>
  );
};
