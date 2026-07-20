import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SplashPage.module.css';
import { LoginModal } from '../../../components/Form';
import { AuthContext } from '@/auth/AuthProvider';
import { StudiesGridView } from '../StudiesGridView/StudiesGridView';
import { StudyIntakeWizard } from '../../StudyViewer/NewStudyWizard/StudyIntakeWizard';
import type { StudyIntake } from '../../StudyViewer/NewStudyWizard/StudyIntakeWizard';
import { CohortsDataService } from '../../LeftPanel/CohortsDataService';

export const SplashPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showIntakeWizard, setShowIntakeWizard] = useState(false);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const isAnonymous = user?.isAnonymous ?? true;

  const handleExtractCohorts = () => {
    if (isAnonymous) {
      setIsLoginModalOpen(true);
    } else {
      setShowIntakeWizard(true);
    }
  };

  const handleReviewTLFs = () => {
    if (isAnonymous) {
      setIsLoginModalOpen(true);
    }
    // TLF intake form — coming soon
  };

  const handleIntakeFinish = async (intake: StudyIntake, action: 'shell' | 'ai') => {
    setShowIntakeWizard(false);
    try {
      const { createStudyFromIntake } = await import('@/views/LeftPanel/studyNavigationHelpers');
      await createStudyFromIntake(intake, action, navigate);
    } catch (error) {
      console.error('Failed to create study from intake:', error);
    }
  };

  const handleSkipIntake = async () => {
    setShowIntakeWizard(false);
    try {
      const { createAndNavigateToNewStudy } = await import('@/views/LeftPanel/studyNavigationHelpers');
      await createAndNavigateToNewStudy(navigate);
    } catch (error) {
      console.error('Failed to create study:', error);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <div className={styles.heroLabel}>What would you like to do?</div>
        <div className={styles.moduleCards}>
          <div className={styles.moduleCard} onClick={handleExtractCohorts}>
            <div className={styles.moduleIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v5c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 10v5c0 1.66 4.03 3 9 3s9-1.34 9-3v-5" />
              </svg>
            </div>
            <h2 className={styles.moduleTitle}>Extract Cohorts</h2>
            <p className={styles.moduleDescription}>
              Define patient cohorts and phenotypes, then automatically generate SQL to extract
              analysis-ready datasets from your database.
            </p>
            <span className={styles.moduleAction}>
              {isAnonymous ? 'Sign in to get started' : 'Start a new study →'}
            </span>
          </div>

          <div className={`${styles.moduleCard} ${styles.moduleCardDisabled}`} onClick={handleReviewTLFs}>
            <div className={styles.moduleCardTop}>
              <div className={styles.moduleIcon}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                  <path d="M13 13h4" />
                  <path d="M13 17h4" />
                </svg>
              </div>
              <span className={styles.comingSoonBadge}>Coming soon</span>
            </div>
            <h2 className={styles.moduleTitle}>Review TLFs</h2>
            <p className={styles.moduleDescription}>
              Already ran your study? Upload results and explore Tables, Listings, and Figures
              with interactive analysis tools.
            </p>
            <span className={styles.moduleAction}>Review results →</span>
          </div>
        </div>
      </div>

      <div className={styles.studiesSection}>
        <div className={styles.studiesSectionHeader}>
          <h2
            className={styles.studiesSectionTitle}
            onClick={() => navigate('/studies')}
          >
            My Studies
            <span className={styles.studiesSectionArrow}>→</span>
          </h2>
        </div>
        <StudiesGridView hideTitle />
      </div>

      <StudyIntakeWizard
        isVisible={showIntakeWizard}
        onClose={() => setShowIntakeWizard(false)}
        onFinish={handleIntakeFinish}
        onSkip={handleSkipIntake}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};
