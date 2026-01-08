import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';
import { Tabs } from '../ButtonsAndTabs/Tabs/Tabs';
import { PhenExNavBarMenu } from './PhenExNavBarMenu';
import { TwoPanelCohortViewerService } from '../../views/CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';

interface CohortNavBarProps {
  height: number;
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
}

// Options Menu Component
const OptionsMenu: React.FC<{ 
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
  const viewerService = TwoPanelCohortViewerService.getInstance();

  const handleMenuItemClick = (viewType: string) => {
    viewerService.displayExtraContent(viewType, null);
    onClose();
  };

  const menuItems = [
    { type: 'info', label: 'Info' },
    { type: 'database', label: 'Database' },
    { type: 'codelists', label: 'Codelists' },
    { type: 'constants', label: 'Constants' },
  ];

  return (
    <PhenExNavBarMenu 
      isOpen={isOpen} 
      onClose={onClose} 
      anchorElement={anchorElement}
      menuRef={menuRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ padding: '8px', minWidth: '180px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {menuItems.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleMenuItemClick(type)}
              className={styles.addMenuItem}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <span>{label}</span>
              <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
                <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    </PhenExNavBarMenu>
  );
};

export const CohortNavBar: React.FC<CohortNavBarProps> = ({ height, onSectionTabChange, dragHandleRef }) => {
  const tabs = ['Definition', 'Characteristics', 'Outcomes'];
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.navBar} style={{ height: `${height}px` }}>
      <div ref={dragHandleRef} data-drag-handle style={{ cursor: 'grab', userSelect: 'none', padding: '0 0' }}>
        {/* ⋮⋮ */}
      </div>
      <Tabs
        tabs={tabs}
        onTabChange={onSectionTabChange || (() => {})}
        active_tab_index={0}
        classNameTabs = {styles.classNameSectionTabs}
        classNameTabsContainer={styles.classNameTabsContainer}
        classNameActiveTab={styles.classNameActiveTab}
        classNameHoverTab={styles.classNameHoverTab}
      />
      <button
        ref={optionsButtonRef}
        className={styles.optionsButton}
        onMouseEnter={() => setIsOptionsMenuOpen(true)}
        onMouseLeave={() => {
          setTimeout(() => {
            if (!menuRef.current?.matches(':hover')) {
              setIsOptionsMenuOpen(false);
            }
          }, 100);
        }}
        title="Options"
      >
        <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="4" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="20" r="2" />
        </svg>
      </button>
      
      <OptionsMenu
        isOpen={isOptionsMenuOpen}
        onClose={() => setIsOptionsMenuOpen(false)}
        anchorElement={optionsButtonRef.current}
        menuRef={menuRef}
        onMouseEnter={() => setIsOptionsMenuOpen(true)}
        onMouseLeave={() => setIsOptionsMenuOpen(false)}
      />
    </div>
  );
};
