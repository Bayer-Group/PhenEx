import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudiesGridView.module.css';
import { CohortsDataService, StudyData } from '../../LeftPanel/CohortsDataService';
import { getCurrentUser } from '@/auth/userProviderBridge';

export const StudiesGridView = () => {
  const [userStudies, setUserStudies] = useState<StudyData[]>([]);
  const [publicStudies, setPublicStudies] = useState<StudyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const navigate = useNavigate();
  const dataService = CohortsDataService.getInstance();

  useEffect(() => {
    const loadStudies = async () => {
      setLoading(true);
      try {
        // Check if user is signed in
        const currentUser = getCurrentUser();
        const isUserAnonymous = currentUser?.isAnonymous ?? true;
        setIsAnonymous(isUserAnonymous);

        // Force fresh data by clearing cache in the data service
        // @ts-ignore - accessing private properties to force refresh
        dataService._userStudies = null;
        // @ts-ignore
        dataService._publicStudies = null;

        const [user, publicStuds] = await Promise.all([
          dataService.getUserStudies(),
          dataService.getPublicStudies()
        ]);
        
        setUserStudies(user);
        setPublicStudies(publicStuds);
      } catch (error) {
        console.error('Failed to load studies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStudies();

    // Listen for changes
    const listener = () => {
      loadStudies();
    };
    dataService.addListener(listener);

    return () => dataService.removeListener(listener);
  }, []);

  const handleStudyClick = (studyId: string) => {
    navigate(`/studies/${studyId}`);
  };

  const renderStudyCard = (study: StudyData) => {
    return (
      <div
        key={study.id}
        className={styles.studyCard}
        onClick={() => handleStudyClick(study.id)}
      >
        <div className={styles.studyCardHeader}>
          <h3 className={styles.studyCardTitle}>{study.name}</h3>
        </div>
        {study.description && (
          <div className={styles.studyCardDescription}>
            {study.description}
          </div>
        )}
        <div className={styles.studyCardFooter}>
          <span className={styles.studyCardType}>
            {study.is_public ? 'Public' : 'Private'}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading studies...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>My Studies</h2>
        {isAnonymous ? (
          <div className={styles.signInPrompt}>
            Sign in to see your studies
          </div>
        ) : userStudies.length > 0 ? (
          <div className={styles.studiesGrid}>
            {userStudies.map(renderStudyCard)}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>No studies yet.</p>
            <p>Create a new study from the left panel.</p>
          </div>
        )}
      </div>

      {publicStudies.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Public Studies</h2>
          <div className={styles.studiesGrid}>
            {publicStudies.map(renderStudyCard)}
          </div>
        </div>
      )}
    </div>
  );
};
