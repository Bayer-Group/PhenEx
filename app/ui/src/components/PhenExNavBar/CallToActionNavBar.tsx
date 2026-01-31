import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';
import { SwitchButton } from '../ButtonsAndTabs/SwitchButton/SwitchButton';
import { PhenExNavBarMenu } from './PhenExNavBarMenu';
import { useNavBarMenu } from './PhenExNavBarMenuContext';
import { CohortDataService } from '../../views/CohortViewer/CohortDataService/CohortDataService';

export interface MenuItem {
  type: string;
  label: string;
  divider?: boolean;
  onClick?: () => void;
}

interface CallToActionNavBarProps {
  height: number;
  showReport?: boolean;
  onShowReportChange?: (value: boolean) => void;
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
  shadow?: boolean;
  menuItems?: MenuItem[];
  mode?: 'cohortviewer' | 'studyviewer';
  onAddButtonClick?: () => void;
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
      verticalPosition={'alignTop'}
      horizontalAlignment={'right'}
      gap={0}
    >
      <div style={{ padding: '8px', minWidth: '240px' }}>
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
      </div>
    </PhenExNavBarMenu>
  );
};

// Options Menu Component (for CohortNavBar section)
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

export const CallToActionNavBar: React.FC<CallToActionNavBarProps> = ({ 
  height, 
  showReport = false,
  onShowReportChange,
  onSectionTabChange,
  dragHandleRef,
  shadow = false,
  menuItems = [],
  mode = 'cohortviewer',
  onAddButtonClick
}) => {
  // CohortNavBar section state
  const sections = ['Definition', 'Characteristics', 'Outcomes'];
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  
  // Menu states
  const { isOpen: isOptionsMenuOpen, open: openOptionsMenu, close: closeOptionsMenu } = useNavBarMenu('options');
  const { isOpen: isSectionMenuOpen, open: openSectionMenu, close: closeSectionMenu } = useNavBarMenu('section');
  const { isOpen: isAddMenuOpen, open: openAddMenu, close: closeAddMenu } = useNavBarMenu('add');
  const { isOpen: isTooltipOpen, open: openTooltip, close: closeTooltip } = useNavBarMenu('add-tooltip');
  
  // Refs
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const sectionButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sectionMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isCohortViewer = mode === 'cohortviewer';
  const isStudyViewer = mode === 'studyviewer';

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
    <div className={`${styles.navBar} ${styles.CallToActionNavBar} ${shadow ? '' : styles.noshadow}`} style={{ height: `${height}px`, display: 'flex', alignItems: 'center', gap: '0px' }}>
      {/* Left: CohortNavBar section */}
      <div>
        <div ref={dragHandleRef} data-drag-handle style={{ cursor: 'grab', userSelect: 'none', padding: '0 0' }}>
          {/* ⋮⋮ */}
        </div>
        
        <button
          ref={sectionButtonRef}
          className={styles.sectionButton}
          style={{ marginRight: 10}}
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

      {/* Center: Switch Button */}
      <div style={{ display: 'flex', alignItems: 'center', marginRight: '28px'}}>
        <SwitchButton
          tooltip="Show report"
          value={showReport}
          onValueChange={onShowReportChange}
          classNameSwitchContainer={styles.switchContainer}
          classNameSwitchBackground={styles.switchBackground}
          classNameSwitchBackgroundSelected={styles.switchBackgroundSelected}
          classNameSwitch={styles.switch}
          classNameSwitchSelected={styles.switchSelected}
          verticalPosition='below'
        />
      </div>

      {/* Right: Add Button */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
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
                if (!addMenuRef.current?.matches(':hover')) {
                  closeAddMenu();
                }
              }, 100);
            } else if (isStudyViewer) {
              closeTooltip();
            }
          }}
          onClick={() => {
            if (isStudyViewer && onAddButtonClick) {
              onAddButtonClick();
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
            menuRef={addMenuRef}
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
            horizontalAlignment={'center'}
          >
            <div style={{ padding: '8px 12px', fontSize: 'var(--font_size_items)', whiteSpace: 'nowrap', color: 'white' }}>
              Add a cohort
            </div>
          </PhenExNavBarMenu>
        )}
      </div>
    </div>
  );
};
