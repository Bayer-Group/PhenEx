import React, { useRef } from 'react';
import styles from './NavBar.module.css';
import { Tabs } from '../ButtonsAndTabs/Tabs/Tabs';
import { PhenExNavBarMenu } from './PhenExNavBarMenu';
import { useNavBarMenu } from './PhenExNavBarMenuContext';

export interface MenuItem {
  type: string;
  label: string;
  divider?: boolean;
  onClick?: () => void;
}

interface CohortNavBarProps {
  height: number;
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
  shadow: boolean;
  menuItems?: MenuItem[];
}

// Options Menu Component
const OptionsMenu: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  anchorElement: HTMLElement | null;
  menuRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  menuItems: MenuItem[];
}> = ({
  isOpen,
  onClose,
  anchorElement,
  menuRef,
  onMouseEnter,
  onMouseLeave,
  menuItems,
}) => {

  const handleMenuItemClick = (item: MenuItem) => {
    if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <PhenExNavBarMenu 
      isOpen={isOpen} 
      onClose={onClose} 
      anchorElement={anchorElement}
      menuRef={menuRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      verticalPosition='below'
    >
      <div style={{ padding: '8px 4px', minWidth: '180px' }}>
        <div className={styles.itemList}>
          {menuItems.map((item) => (
            <React.Fragment key={item.type}>
              {item.divider && (
                <div style={{ height: '1px', backgroundColor: '#e0e0e0', margin: '4px 0', width: '100%' }} />
              )}
              <button
                onClick={() => handleMenuItemClick(item)}
                className={styles.addMenuItem}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <span>{item.label}</span>
                <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
                </svg>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>
    </PhenExNavBarMenu>
  );
};

export const CohortNavBar: React.FC<CohortNavBarProps> = ({ height, onSectionTabChange, dragHandleRef, shadow = false, menuItems = [] }) => {
  const tabs = ['Definition', 'Characteristics', 'Outcomes'];
  const { isOpen: isOptionsMenuOpen, open: openOptionsMenu, close: closeOptionsMenu } = useNavBarMenu('options');
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`${styles.navBar} ${shadow ? '' : styles.noshadow}`} style={{ height: `${height}px` }}>
      <div ref={dragHandleRef} data-drag-handle style={{ cursor: 'grab', userSelect: 'none', padding: '0 0' }}>
        {/* ⋮⋮ */}
      </div>
      {/* <button
        ref={optionsButtonRef}
        className={styles.optionsButton}
        onMouseEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isOptionsMenuOpen) {
            openOptionsMenu();
          }
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isOptionsMenuOpen) {
            openOptionsMenu();
          }
        }}
        onMouseLeave={() => {
          setTimeout(() => {
            if (!menuRef.current?.matches(':hover')) {
              closeOptionsMenu();
            }
          }, 100);
        }}
      >
        <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="4" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="20" r="2" />
        </svg>
      </button> */}
      <Tabs
        tabs={tabs}
        onTabChange={onSectionTabChange || (() => {})}
        active_tab_index={0}
        classNameTabs = {styles.classNameSectionTabs}
        classNameTabsContainer={styles.classNameTabsContainer}
        classNameActiveTab={styles.classNameActiveTab}
        classNameHoverTab={styles.classNameHoverTab}
      />

      
      <OptionsMenu
        isOpen={isOptionsMenuOpen}
        onClose={closeOptionsMenu}
        anchorElement={optionsButtonRef.current}
        menuRef={menuRef}
        onMouseEnter={openOptionsMenu}
        onMouseLeave={closeOptionsMenu}
        menuItems={menuItems}
      />
    </div>
  );
};
