import React, { useRef, useState } from 'react';
import styles from './NavBar.module.css';
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
  const sections = ['Definition', 'Characteristics', 'Outcomes'];
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const { isOpen: isOptionsMenuOpen, open: openOptionsMenu, close: closeOptionsMenu } = useNavBarMenu('options');
  const { isOpen: isSectionMenuOpen, open: openSectionMenu, close: closeSectionMenu } = useNavBarMenu('section');
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const sectionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sectionMenuRef = useRef<HTMLDivElement>(null);

  const getShuffledSections = () => {
    const shuffled = [...sections];
    const activeItem = shuffled.splice(activeTabIndex, 1)[0];
    return [activeItem, ...shuffled];
  };

  const handleSectionClick = (section: string) => {
    const originalIndex = sections.indexOf(section);
    setActiveTabIndex(originalIndex);
    if (onSectionTabChange) {
      onSectionTabChange(originalIndex);
    }
    closeSectionMenu();
  };

  return (
    <div className={`${styles.navBar} ${shadow ? '' : styles.noshadow}`} style={{ height: `${height}px` }}>
      <div ref={dragHandleRef} data-drag-handle style={{ cursor: 'grab', userSelect: 'none', padding: '0 0' }}>
        {/* ⋮⋮ */}
      </div>
      
      <button
        ref={sectionButtonRef}
        className={styles.sectionButton}
        onMouseEnter={() => {
          openSectionMenu();
        }}
        onMouseLeave={() => {
          setTimeout(() => {
            if (!sectionMenuRef.current?.matches(':hover')) {
              closeSectionMenu();
            }
          }, 100);
        }}
      >
        {sections[activeTabIndex]}
      </button>

      <PhenExNavBarMenu
        isOpen={isSectionMenuOpen}
        onClose={closeSectionMenu}
        anchorElement={sectionButtonRef.current}
        menuRef={sectionMenuRef}
        onMouseEnter={openSectionMenu}
        onMouseLeave={closeSectionMenu}
        verticalPosition='alignTop'
        gap={0}
      >
        <div style={{ padding: '8px 4px', minWidth: '180px' }}>
          <div className={styles.itemList}>
            {getShuffledSections().map((section) => (
              <button
                key={section}
                onClick={() => handleSectionClick(section)}
                className={styles.addMenuItem}
              >
                {section}
              </button>
            ))}
          </div>
        </div>
      </PhenExNavBarMenu>
  
    </div>
  );
};
