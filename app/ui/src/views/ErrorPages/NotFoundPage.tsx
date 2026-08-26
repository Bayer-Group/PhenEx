import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ErrorPage.module.css';

export const NotFoundPage: FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className={styles.errorTitle}>Study Not Found</h1>
        <p className={styles.errorMessage}>
          Could not find this study.
        </p>
        <p className={styles.errorDescription}>
          This study may have been deleted or you may have followed an incorrect link.
        </p>
        <button 
          className={styles.errorButton}
          onClick={() => navigate('/studies')}
        >
          Go to My Studies
        </button>
      </div>
    </div>
  );
};
