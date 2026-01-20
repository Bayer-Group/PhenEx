import { forwardRef, useState, useRef } from 'react';
import styles from './CohortCardActions.module.css';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import { PhenExNavBarMenu } from '../../../components/PhenExNavBar/PhenExNavBarMenu';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { useNavBarMenu } from '../../../components/PhenExNavBar/PhenExNavBarMenuContext';

interface CohortCardActionsProps {
  cohortId: string;
  studyDataService: any;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const CohortCardActions = forwardRef<HTMLDivElement, CohortCardActionsProps>(
  ({ cohortId, studyDataService, onMouseEnter, onMouseLeave }, ref) => {
    const { isOpen: isAddMenuOpen, open: openAddMenu, close: closeAddMenu } = useNavBarMenu('cohort-card-add');
    const { isOpen: isOptionsMenuOpen, open: openOptionsMenu, close: closeOptionsMenu } = useNavBarMenu('cohort-card-options');
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const optionsButtonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null!);
    const optionsMenuRef = useRef<HTMLDivElement>(null!);
    const [activeTab, setActiveTab] = useState(0);
    const [isMenuHovered, setIsMenuHovered] = useState(false);
    const [isOptionsMenuHovered, setIsOptionsMenuHovered] = useState(false);
    const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const optionsKeepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const addMenuDelayRef = useRef<NodeJS.Timeout | null>(null);

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
      <div
        ref={ref}
        className={styles.cohortCardActionsContainer}
        onMouseEnter={onMouseEnter}
        onMouseLeave={() => {
          // Only trigger parent leave if we're definitely not hovering any menu
          setTimeout(() => {
            if (!isMenuHovered && !isOptionsMenuHovered) {
              onMouseLeave();
            }
          }, 50);
        }}
      >
        {/* Large invisible bridge to catch mouse movement */}
        <div 
          onMouseEnter={onMouseEnter}
          style={{
            position: 'absolute',
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 'calc(100px / var(--zoom-scale, 1))',
            height: 'calc(200px / var(--zoom-scale, 1))',
            background: 'transparent',
            pointerEvents: 'auto',
            zIndex: -1,
          }} 
        />
        <button
          ref={addButtonRef}
          className={`${styles.actionButton} ${isAddMenuOpen ? styles.menuOpen : ''}`}
          onMouseEnter={() => {
            // Add slight delay before opening menu
            addMenuDelayRef.current = setTimeout(() => {
              openAddMenu();
            }, 200);
          }}
          onMouseLeave={() => {
            // Clear delay if mouse leaves before menu opens
            if (addMenuDelayRef.current) {
              clearTimeout(addMenuDelayRef.current);
              addMenuDelayRef.current = null;
            }
            setTimeout(() => {
              if (!menuRef.current?.matches(':hover')) {
                closeAddMenu();
              }
            }, 100);
          }}
          style={{
            width: 'var(--dynamic-button-size)',
            height: 'var(--dynamic-button-size)',
            fontSize: 'var(--dynamic-font-size)',
          }}
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

        {/* <button
          ref={optionsButtonRef}
          className={`${styles.actionButton}`}
          onMouseEnter={openOptionsMenu}
          onMouseLeave={() => {
            setTimeout(() => {
              if (!optionsMenuRef.current?.matches(':hover')) {
                closeOptionsMenu();
              }
            }, 100);
          }}
          style={{
            width: 'var(--dynamic-button-size)',
            height: 'var(--dynamic-button-size)',
            fontSize: 'var(--dynamic-font-size)',
          }}
        >
          <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <circle cx="12" cy="6" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="18" r="2" />
          </svg>
        </button> */}

        {/* Transparent bridge to prevent losing hover state */}
        {isAddMenuOpen && (
          <div 
            onMouseEnter={onMouseEnter}
            style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              transform: 'translateX(-50%)',
              width: 'calc(260px / var(--zoom-scale))', // Match menu width + margin
              height: 'calc(20px / var(--zoom-scale))', // Bridge the gap
              background: 'transparent',
              pointerEvents: 'auto',
            }} 
          />
        )}

        <PhenExNavBarMenu 
          isOpen={isAddMenuOpen} 
          onClose={closeAddMenu} 
          anchorElement={addButtonRef.current}
          menuRef={menuRef}
          onMouseEnter={() => {
            setIsMenuHovered(true);
            openAddMenu();
            onMouseEnter(); // Initial call to keep card in hover state
            
            // Keep calling onMouseEnter periodically to maintain hover state
            if (keepAliveIntervalRef.current) {
              clearInterval(keepAliveIntervalRef.current);
            }
            keepAliveIntervalRef.current = setInterval(() => {
              onMouseEnter();
            }, 100);
          }}
          onMouseLeave={() => {
            setIsMenuHovered(false);
            closeAddMenu();
            
            // Stop keep-alive
            if (keepAliveIntervalRef.current) {
              clearInterval(keepAliveIntervalRef.current);
              keepAliveIntervalRef.current = null;
            }
          }}
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

        <PhenExNavBarMenu 
          isOpen={isOptionsMenuOpen} 
          onClose={closeOptionsMenu} 
          anchorElement={optionsButtonRef.current}
          menuRef={optionsMenuRef}
          onMouseEnter={() => {
            setIsOptionsMenuHovered(true);
            openOptionsMenu();
            onMouseEnter();
            
            if (optionsKeepAliveIntervalRef.current) {
              clearInterval(optionsKeepAliveIntervalRef.current);
            }
            optionsKeepAliveIntervalRef.current = setInterval(() => {
              onMouseEnter();
            }, 100);
          }}
          onMouseLeave={() => {
            setIsOptionsMenuHovered(false);
            closeOptionsMenu();
            
            if (optionsKeepAliveIntervalRef.current) {
              clearInterval(optionsKeepAliveIntervalRef.current);
              optionsKeepAliveIntervalRef.current = null;
            }
          }}
          verticalPosition={'below'}
        >
          <div style={{ padding: '8px', minWidth: '180px' }}>
            <div className={styles.itemList}>
              <button className={styles.addMenuItem}>
                Duplicate
              </button>
              <button className={styles.addMenuItem}>
                Rename
              </button>
              <button className={styles.addMenuItem}>
                Export
              </button>
              <button className={styles.addMenuItem} style={{ color: '#ff4444' }}>
                Delete
              </button>
            </div>
          </div>
        </PhenExNavBarMenu>
      </div>
    );
  }
);

CohortCardActions.displayName = 'CohortCardActions';
