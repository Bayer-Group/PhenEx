import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MainBreadcrumb.module.css';
import { StudyDataService } from '../StudyViewer/StudyDataService';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';

interface MainBreadcrumbProps {
  /** Study id used to build the study-level link. */
  studyId?: string;
  /** Whether the current view is a cohort (adds the cohort-name crumb). */
  showCohort: boolean;
}

/** Breadcrumb for the main view: Studies / {study name} / {cohort name}. */
export const MainBreadcrumb: FC<MainBreadcrumbProps> = ({ studyId, showCohort }) => {
  const navigate = useNavigate();
  const [studyName, setStudyName] = useState('');
  const [cohortName, setCohortName] = useState('');

  useEffect(() => {
    const service = StudyDataService.getInstance();
    const update = () => setStudyName(service.study_name);
    update();
    service.addStudyDataServiceListener(update);
    return () => service.removeStudyDataServiceListener(update);
  }, []);

  useEffect(() => {
    if (!showCohort) {
      setCohortName('');
      return;
    }
    const service = CohortDataService.getInstance();
    const update = () => setCohortName(service.cohort_name);
    update();
    service.addListener(update);
    return () => service.removeListener(update);
  }, [showCohort]);

  return (
    <div className={styles.container} onClick={(e) => e.stopPropagation()}>
      <button
        className={`${styles.crumb} ${styles.crumb_root}`}
        onClick={() => navigate('/studies')}
      >
        Studies
      </button>

      {studyName && (
        <>
          <span className={styles.separator}>/</span>
          <button
            className={`${styles.crumb} ${styles.crumb_study}`}
            onClick={() => studyId && navigate(`/studies/${studyId}`)}
          >
            {studyName}
          </button>
        </>
      )}

      {showCohort && cohortName && (
        <>
          <span className={styles.separator}>/</span>
          <span className={`${styles.crumb} ${styles.crumb_cohort}`}>{cohortName}</span>
        </>
      )}
    </div>
  );
};
