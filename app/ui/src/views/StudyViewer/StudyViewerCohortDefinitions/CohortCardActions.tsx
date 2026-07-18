import React, { useState, useRef } from 'react';
import styles from './CohortCardActions.module.css';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import { PhenExNavBarMenu } from '../../../components/PhenExNavBar/PhenExNavBarMenu';
import { useNavBarMenu } from '../../../components/PhenExNavBar/PhenExNavBarMenuContext';
import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';

interface CohortCardActionsProps {
  cohortId: string;
  studyDataService: any;
  onDeleteCohort?: () => void;
  onOpen?: (e: React.MouseEvent) => void;
}

export const CohortCardActions: React.FC<CohortCardActionsProps> = (
  { cohortId, studyDataService, onDeleteCohort, onOpen }
) => {
    const { isOpen: isAddMenuOpen, open: openAddMenu, close: closeAddMenu } = useNavBarMenu(`cohort-card-add-${cohortId}`);
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null!);
    const [activeTab, setActiveTab] = useState(0);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleClose = () => {
      closeTimerRef.current = setTimeout(() => closeAddMenu(), 150);
    };

    const cancelClose = () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };

    const handleAddPhenotype = (type: string) => {
      studyDataService.cohort_definitions_service.addPhenotype(cohortId, type);
      // Keep menu open after adding phenotype
    };

    const phenotypeTypes = [
      { type: 'entry', label: 'Entry' },
      { type: 'inclusion', label: 'Inclusion' },
      { type: 'exclusion', label: 'Exclusion' },
      { type: 'baseline', label: 'Baseline Characteristic' },
      { type: 'outcome', label: 'Outcome' },
    ];

    return (
      <>
        {onDeleteCohort && (
          <button
            className={`${styles.actionButton} ${styles.deleteButton}`}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCohort();
            }}
            title="Delete cohort"
          >
            <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}

        <button
          ref={addButtonRef}
          className={`${styles.actionButton} ${isAddMenuOpen ? styles.menuOpen : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            isAddMenuOpen ? closeAddMenu() : openAddMenu();
          }}
          onMouseEnter={() => { cancelClose(); openAddMenu(); }}
          onMouseLeave={scheduleClose}
          title="Add phenotype"
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {onOpen && (
          <button
            className={styles.actionButton}
            onClick={onOpen}
            aria-label="Open cohort"
          >
            <img src={ArrowIcon} alt="Expand" className={styles.expandArrow} />
          </button>
        )}

        <PhenExNavBarMenu
          isOpen={isAddMenuOpen}
          onClose={closeAddMenu}
          anchorElement={addButtonRef.current}
          menuRef={menuRef}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          verticalPosition={'below'}
          horizontalAlignment='left'
        >
          <div style={{ padding: '8px', minWidth: '240px' }}>
            {activeTab === 0 && (
              <div className={styles.itemList}>
                {phenotypeTypes.map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => handleAddPhenotype(type)}
                    className={styles.addMenuItem}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {activeTab === 1 && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Library coming soon
              </div>
            )}
            {activeTab === 2 && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Codelist import coming soon
              </div>
            )}
            <Tabs
              tabs={['Manual Entry', 'Library', 'Codelist']}
              active_tab_index={activeTab}
              onTabChange={setActiveTab}
              classNameTabsContainer={styles.addMenuTabsContainer}
              classNameTabs={styles.addMenuTab}
              classNameActiveTab={styles.addMenuActiveTab}
              classNameHoverTab={styles.addMenuHoverTab}
            />
          </div>
        </PhenExNavBarMenu>
      </>
    );
};

CohortCardActions.displayName = 'CohortCardActions';
