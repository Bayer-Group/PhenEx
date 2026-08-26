import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudiesGridView.module.css';
import { CohortsDataService } from '../../LeftPanel/CohortsDataService';
import { AuthContext } from '@/auth/AuthProvider';
import {
  deleteStudy,
  createDemoStudy,
  getStudiesWithModuleStatus,
  StudyWithModuleStatus,
  ModuleStatus,
} from '@/api/text_to_cohort/route';
import { LoginModal } from '../../../components/Form';
import { StudyIntakeWizard } from '../../StudyViewer/NewStudyWizard/StudyIntakeWizard';
import type { StudyIntake } from '../../StudyViewer/NewStudyWizard/StudyIntakeWizard';

// ── Module pill config (extend here as new modules ship) ──────────────────────

interface ModuleDef {
  key: string;
  label: string;
  route: (studyId: string) => string;
  color: string;       // active colour
}

const MODULE_DEFS: ModuleDef[] = [
  { key: 'cohorts', label: 'Cohorts',    route: (id) => `/studies/${id}`, color: '#1a6fbf' },
  { key: 'tlf',     label: 'TLF Review', route: (id) => `/tlfs/${id}`,    color: '#1a8a5e' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface StudiesGridViewProps {
  hideTitle?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const StudiesGridView = ({ hideTitle = false }: StudiesGridViewProps) => {
  const [studies, setStudies] = useState<StudyWithModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmStudy, setDeleteConfirmStudy] = useState<StudyWithModuleStatus | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showIntakeWizard, setShowIntakeWizard] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const dataService = CohortsDataService.getInstance();

  const isAnonymous = user?.isAnonymous ?? true;

  const loadStudies = async () => {
    setLoading(true);
    try {
      const data = await getStudiesWithModuleStatus();
      setStudies(data);
    } catch (error) {
      console.error('Failed to load studies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAnonymous) { setLoading(false); return; }
    loadStudies();
    const listener = () => loadStudies();
    dataService.addListener(listener);
    return () => dataService.removeListener(listener);
  }, [user]);

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

  // Navigate to the primary module for a study:
  // If cohorts module has activity → cohort editor; else if TLF → TLF viewer
  const handleStudyClick = (study: StudyWithModuleStatus) => {
    if ((study.modules.cohorts?.status ?? 'none') !== 'none') {
      navigate(`/studies/${study.id}`);
    } else if ((study.modules.tlf?.status ?? 'none') !== 'none') {
      navigate(`/tlfs/${study.id}`);
    } else {
      navigate(`/studies/${study.id}`);
    }
  };

  const handleCreateFirstStudy = () => setShowIntakeWizard(true);

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

  const handleSeeDemo = async () => {
    try {
      const { study_id } = await createDemoStudy();
      dataService.invalidateCache();
      navigate(`/studies/${study_id}`);
    } catch (error) {
      console.error('Failed to create demo study:', error);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, studyId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === studyId ? null : studyId);
  };

  const handleDeleteClick = (e: React.MouseEvent, study: StudyWithModuleStatus) => {
    e.stopPropagation();
    setDeleteConfirmStudy(study);
    setOpenMenuId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmStudy) return;
    try {
      await deleteStudy(deleteConfirmStudy.id);
      dataService.invalidateCache();
      // @ts-ignore
      dataService.notifyListeners();
      await loadStudies();
      setDeleteConfirmStudy(null);
    } catch (error) {
      console.error('Failed to delete study:', error);
      alert('Failed to delete study. Please try again.');
    }
  };

  // ── Study card ─────────────────────────────────────────────────────────────

  const renderStudyCard = (study: StudyWithModuleStatus) => {
    const isMenuOpen = openMenuId === study.id;

    return (
      <div
        key={study.id}
        className={styles.studyCard}
        onClick={() => handleStudyClick(study)}
      >
        {/* Header row */}
        <div className={styles.studyCardHeader}>
          <h3 className={styles.studyCardTitle}>{study.name}</h3>
          {!study.is_public && (
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
                  <button className={styles.menuItem} onClick={(e) => handleDeleteClick(e, study)}>
                    Delete Study
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {study.description && (
          <div className={styles.studyCardDescription}>
            {(() => {
              try {
                const delta = JSON.parse(study.description);
                if (delta?.ops) return delta.ops.map((op: { insert?: unknown }) =>
                  typeof op.insert === 'string' ? op.insert : '').join('');
              } catch {}
              return study.description;
            })()}
          </div>
        )}

        {/* Module pills */}
        <div className={styles.modulePills}>
          {MODULE_DEFS.map((def) => {
            const mod: ModuleStatus = study.modules[def.key] ?? { status: 'none', detail: null };
            const isActive = mod.status !== 'none';
            return (
              <button
                key={def.key}
                className={`${styles.modulePill} ${isActive ? styles.modulePillActive : styles.modulePillNone}`}
                style={isActive ? { '--pill-color': def.color } as React.CSSProperties : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isActive) navigate(def.route(study.id));
                }}
                title={mod.detail ?? `${def.label} — not started`}
              >
                <span className={`${styles.pillDot} ${isActive ? styles.pillDotActive : ''}`}
                  style={isActive ? { background: def.color } : undefined}
                />
                <span className={styles.pillLabel}>{def.label}</span>
                {mod.detail && <span className={styles.pillDetail}>{mod.detail}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
        {!hideTitle && (
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>My Studies</h2>
            {!isAnonymous && studies.length > 0 && (
              <button className={styles.newStudyButton} onClick={handleCreateFirstStudy}>
                + New Study
              </button>
            )}
          </div>
        )}

        {isAnonymous ? (
          <div className={styles.emptyStateWithCta}>
            <div className={styles.ctaContent}>
              <h3 className={styles.ctaTitle}>Welcome to PhenEx!</h3>
              <p className={styles.ctaDescription}>
                Sign in to create and manage your own studies, save your work, and access your personal cohort definitions.
              </p>
              <button className={styles.ctaButton} onClick={() => setIsLoginModalOpen(true)}>
                Sign In
              </button>
            </div>
          </div>
        ) : studies.length > 0 ? (
          <div className={styles.studiesGrid}>
            {studies.map((study) => renderStudyCard(study))}
          </div>
        ) : (
          <div className={styles.emptyStateWithCta}>
            <div className={styles.ctaContent}>
              <p className={styles.ctaDescription}>
                To get started, choose an option above. Or explore a demo study to see PhenEx in action.
              </p>
              <button className={styles.ctaButtonSecondary} onClick={handleSeeDemo}>
                Load demo study
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirmStudy && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmStudy(null)}>
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
              <button className={styles.alertCancelButton} onClick={() => setDeleteConfirmStudy(null)}>
                Cancel
              </button>
              <button className={styles.alertDeleteButton} onClick={handleConfirmDelete}>
                Delete Study
              </button>
            </div>
          </div>
        </div>
      )}

      <StudyIntakeWizard
        isVisible={showIntakeWizard}
        onClose={() => setShowIntakeWizard(false)}
        onFinish={handleIntakeFinish}
        onSkip={handleSkipIntake}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};
