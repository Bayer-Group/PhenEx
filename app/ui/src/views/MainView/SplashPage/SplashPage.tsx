import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SplashPage.module.css';
import phenexLogo from '../../../assets/bird_icon.png';
import { LoginModal } from '../../../components/Form';
import { AuthContext } from '@/auth/AuthProvider';

export const SplashPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const isAnonymous = user?.isAnonymous ?? true;

  const handleSignIn = () => {
    setIsLoginModalOpen(true);
  };

  const handleExploreStudies = () => {
    navigate('/studies');
  };

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    // Navigate to studies page after login
    navigate('/studies');
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.label} ${styles.topLeft}`}></div>
      <div className={styles.header}>
        <img src={phenexLogo} alt="PhenEx Logo" className={styles.logo} />
      </div>

      <div className={styles.content}>
        <div className={styles.text}>
          <p>
            <span className={styles.title}>PhenEx</span> separates observational study definition
            from SQL code implementation.
          </p>
          <p>
            Define your study using PhenEx phenotypes, and the code to extract analysis-ready
            datasets is <em>automatically generated</em>. Table1 and time to event analyses are also
            included.
          </p>
        </div>

        <div className={styles.ctaSection}>
          <div className={styles.ctaButtons}>
            {isAnonymous ? (
              <>
                <button className={styles.primaryCta} onClick={handleSignIn}>
                  Sign In to Create Studies
                </button>
                <button className={styles.secondaryCta} onClick={handleExploreStudies}>
                  Explore Public Studies
                </button>
              </>
            ) : (
              <>
                <button className={styles.primaryCta} onClick={handleExploreStudies}>
                  Start Creating Studies
                </button>
                <button className={styles.secondaryCta} onClick={handleExploreStudies}>
                  Explore Public Studies
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={`${styles.label} ${styles.bottomRight}`}></div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};
