import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ErrorPage.module.css';

export const UnauthorizedPage: FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className={styles.errorTitle}>Access Denied</h1>
        <p className={styles.errorMessage}>
          You do not have permission to view this page.
        </p>
        <p className={styles.errorDescription}>
          This content may be private or you may need to sign in with a different account.
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
