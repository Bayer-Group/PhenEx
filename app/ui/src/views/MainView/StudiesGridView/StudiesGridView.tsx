import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudiesGridView.module.css';
import { CohortsDataService, StudyData } from '../../LeftPanel/CohortsDataService';
import { getCurrentUser } from '@/auth/userProviderBridge';
import { deleteStudy } from '@/api/text_to_cohort/route';

export const StudiesGridView = () => {
  const [userStudies, setUserStudies] = useState<StudyData[]>([]);
  const [publicStudies, setPublicStudies] = useState<StudyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmStudy, setDeleteConfirmStudy] = useState<StudyData | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  const handleStudyClick = (studyId: string) => {
    navigate(`/studies/${studyId}`);
  };

  const handleCreateFirstStudy = async () => {
    try {
      // Use centralized helper to ensure consistent behavior
      const { createAndNavigateToNewStudy } = await import('@/views/LeftPanel/studyNavigationHelpers');
      await createAndNavigateToNewStudy(navigate);
    } catch (error) {
      console.error('Failed to create study:', error);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, studyId: string) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(openMenuId === studyId ? null : studyId);
  };

  const handleDeleteClick = (e: React.MouseEvent, study: StudyData) => {
    e.stopPropagation(); // Prevent card click
    setDeleteConfirmStudy(study);
    setOpenMenuId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmStudy) return;
    
    try {
      await deleteStudy(deleteConfirmStudy.id);
      
      console.log('🗑️ Study deleted, clearing all caches and notifying listeners');
      
      // Force cache refresh by invalidating the cache
      dataService.invalidateCache();
      
      // Notify listeners to trigger left panel update
      // @ts-ignore - accessing private method to force notification
      dataService.notifyListeners();
      
      // Refresh the studies list with fresh data
      const [user, publicStuds] = await Promise.all([
        dataService.getUserStudies(),
        dataService.getPublicStudies()
      ]);
      setUserStudies(user);
      setPublicStudies(publicStuds);
      setDeleteConfirmStudy(null);
    } catch (error) {
      console.error('Failed to delete study:', error);
      alert('Failed to delete study. Please try again.');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmStudy(null);
  };

  const renderStudyCard = (study: StudyData, isUserStudy: boolean = false) => {
    const isMenuOpen = openMenuId === study.id;
    
    return (
      <div
        key={study.id}
        className={styles.studyCard}
        onClick={() => handleStudyClick(study.id)}
      >
        <div className={styles.studyCardHeader}>
          <h3 className={styles.studyCardTitle}>{study.name}</h3>
          {isUserStudy && !study.is_public && (
            <div className={styles.menuContainer} ref={isMenuOpen ? menuRef : null}>
              <button
                className={styles.menuButton}
                onClick={(e) => handleMenuClick(e, study.id)}
                aria-label="Study options"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="4" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="10" cy="16" r="1.5" />
                </svg>
              </button>
              {isMenuOpen && (
                <div className={styles.menuDropdown}>
                  <button
                    className={styles.menuItem}
                    onClick={(e) => handleDeleteClick(e, study)}
                  >
                    Delete Study
                  </button>
                </div>
              )}
            </div>
          )}
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
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>My Studies</h2>
          {!isAnonymous && userStudies.length > 0 && (
            <button 
              className={styles.newStudyButton}
              onClick={handleCreateFirstStudy}
            >
              + New Study
            </button>
          )}
        </div>
        {isAnonymous ? (
          <div className={styles.signInPrompt}>
            Sign in to see your studies
          </div>
        ) : userStudies.length > 0 ? (
          <div className={styles.studiesGrid}>
            {userStudies.map(study => renderStudyCard(study, true))}
          </div>
        ) : (
          <div className={styles.emptyStateWithCta}>
            <div className={styles.ctaContent}>
              <h3 className={styles.ctaTitle}>Let's get started!</h3>
              <p className={styles.ctaDescription}>
                Create your first study to begin defining cohorts and analyzing patient data.
              </p>
              <button 
                className={styles.ctaButton}
                onClick={handleCreateFirstStudy}
              >
                Create Your First Study
              </button>
            </div>
          </div>
        )}
      </div>

      {publicStudies.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Public Studies</h2>
          <div className={styles.studiesGrid}>
            {publicStudies.map(study => renderStudyCard(study, false))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmStudy && (
        <div className={styles.modalOverlay} onClick={handleCancelDelete}>
          <div className={styles.alertModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.alertIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className={styles.alertTitle}>Delete Study?</h3>
            <p className={styles.alertMessage}>
              Are you sure you want to delete <strong>"{deleteConfirmStudy.name}"</strong>?
            </p>
            <p className={styles.alertWarning}>
              This action cannot be undone. All cohorts in this study will be permanently deleted.
            </p>
            <div className={styles.alertActions}>
              <button className={styles.alertCancelButton} onClick={handleCancelDelete}>
                Cancel
              </button>
              <button className={styles.alertDeleteButton} onClick={handleConfirmDelete}>
                Delete Study
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
