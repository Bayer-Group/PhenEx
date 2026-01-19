import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';
import { Tabs } from '../ButtonsAndTabs/Tabs/Tabs';
import { PhenExNavBarMenu } from './PhenExNavBarMenu';
import { CohortDataService } from '../../views/CohortViewer/CohortDataService/CohortDataService';
import { useNavBarMenu } from './PhenExNavBarMenuContext';

interface AddButtonNavBarProps {
  height: number;
  mode?: 'cohortviewer' | 'studyviewer';
  onSectionTabChange?: (index: number) => void;
  onButtonClick?: () => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
}

// Add Menu Component
const AddMenu: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  anchorElement: HTMLElement | null;
  menuRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({
  isOpen,
  onClose,
  anchorElement,
  menuRef,
  onMouseEnter,
  onMouseLeave,
}) => {
  const dataService = CohortDataService.getInstance();
  const [activeTab, setActiveTab] = useState(0);

  const handleAddPhenotype = (type: string) => {
    dataService.addPhenotype(type);
  };

  const phenotypeTypes = [
    { type: 'entry', label: 'Entry' },
    { type: 'inclusion', label: 'Inclusion' },
    { type: 'exclusion', label: 'Exclusion' },
    { type: 'baseline', label: 'Baseline Characteristic' },
    { type: 'outcome', label: 'Outcome' },
  ];

  return (
    <PhenExNavBarMenu 
      isOpen={isOpen} 
      onClose={onClose} 
      anchorElement={anchorElement}
      menuRef={menuRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      verticalPosition={'below'}
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
  );
};

export const AddButtonNavBar: React.FC<AddButtonNavBarProps> = ({ 
  height, 
  mode = 'cohortviewer',
  onSectionTabChange, 
  onButtonClick,
  dragHandleRef 
}) => {
  const { isOpen: isAddMenuOpen, open: openAddMenu, close: closeAddMenu } = useNavBarMenu('add');
  const { isOpen: isTooltipOpen, open: openTooltip, close: closeTooltip } = useNavBarMenu('add-tooltip');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isCohortViewer = mode === 'cohortviewer';
  const isStudyViewer = mode === 'studyviewer';

  return (
    <div className={`${styles.navBar} ${styles.navBarAddButton}`} style={{ height: `${height}px` , width: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        ref={addButtonRef}
        className={styles.addButton}
        onMouseEnter={() => {
          if (isCohortViewer) {
            openAddMenu();
          } else if (isStudyViewer) {
            openTooltip();
          }
        }}
        onMouseLeave={() => {
          if (isCohortViewer) {
            setTimeout(() => {
              if (!menuRef.current?.matches(':hover')) {
                closeAddMenu();
              }
            }, 100);
          } else if (isStudyViewer) {
            closeTooltip();
          }
        }}
        onClick={() => {
          if (isStudyViewer && onButtonClick) {
            onButtonClick();
          }
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      
      {isCohortViewer && (
        <AddMenu
          isOpen={isAddMenuOpen}
          onClose={closeAddMenu}
          anchorElement={addButtonRef.current}
          menuRef={menuRef}
          onMouseEnter={openAddMenu}
          onMouseLeave={closeAddMenu}
        />
      )}
      
      {isStudyViewer && (
        <PhenExNavBarMenu
          isOpen={isTooltipOpen}
          onClose={closeTooltip}
          anchorElement={addButtonRef.current}
          menuRef={tooltipRef}
          verticalPosition={'below'}
        >
          <div style={{ padding: '8px 12px', fontSize: 'var(--font_size_items)', whiteSpace: 'nowrap', color: 'white' }}>
            Add a cohort
          </div>
        </PhenExNavBarMenu>
      )}
    </div>
  );
};
