import React, { useState, useRef } from 'react';
import styles from './NavBar.module.css';
import { PhenExNavBarMenu } from './PhenExNavBarMenu';
import { PhenExNavBarTooltip } from './PhenExNavBarTooltip';
import { SwitchButton } from '../ButtonsAndTabs/SwitchButton/SwitchButton';
import { CohortDataService } from '../../views/CohortViewer/CohortDataService/CohortDataService';

interface ViewNavBarProps {
  height: number;
  scrollPercentage?: number; // Controlled scroll percentage
  canScrollLeft?: boolean;
  canScrollRight?: boolean;
  onViewNavigationArrowClicked?: (direction: 'left' | 'right') => void;
  onViewNavigationScroll?: (percentage: number) => void;
  onViewNavigationVisibilityClicked?: () => void;
}

// Visibility Menu Component
const VisibilityMenu: React.FC<{ 
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
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showChildren, setShowChildren] = useState(() => dataService.getShowComponents());

  const handleShowChildrenChange = (value: boolean) => {
    setShowChildren(value);
    dataService.toggleComponentPhenotypes(value);
  };

  return (
    <PhenExNavBarMenu 
      isOpen={isOpen} 
      onClose={onClose} 
      anchorElement={anchorElement}
      menuRef={menuRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      verticalPosition='above'
      horizontalAlignment='center'
    >
      <div style={{ padding: '12px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>Visibility Options</div>
        
        <SwitchButton
          label="Show Descriptions"
          value={showDescriptions}
          onValueChange={setShowDescriptions}
        />
        
        <SwitchButton
          label="Show Children"
          value={showChildren}
          onValueChange={handleShowChildrenChange}
        />
      </div>
    </PhenExNavBarMenu>
  );
};

export const ViewNavBar: React.FC<ViewNavBarProps> = ({
  height,
  scrollPercentage = 0,
  canScrollLeft = true,
  canScrollRight = true,
  onViewNavigationArrowClicked,
  onViewNavigationScroll,
  onViewNavigationVisibilityClicked,
}) => {
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);
  const leftArrowRef = useRef<HTMLButtonElement>(null);
  const rightArrowRef = useRef<HTMLButtonElement>(null);
  const isDraggingRef = useRef(false);
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
  const [showLeftArrowTooltip, setShowLeftArrowTooltip] = useState(false);
  const [showRightArrowTooltip, setShowRightArrowTooltip] = useState(false);
  const [showThumbTooltip, setShowThumbTooltip] = useState(false);
  const eyeButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowThumbTooltip(false);
    isDraggingRef.current = true;
    updateScrollPosition(e);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) {
        updateScrollPosition(moveEvent as any);
      }
    };
    
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const updateScrollPosition = (e: React.MouseEvent | MouseEvent) => {
    if (!scrollBarRef.current) return;
    
    const rect = scrollBarRef.current.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    onViewNavigationScroll?.(percentage);
  };
  
  const renderArrows = () => {
    return (

    <div className={styles.navArrowsContainer}>
        <button
            ref={leftArrowRef}
            className={styles.navArrowButton}
            onClick={() => {
              setShowLeftArrowTooltip(false);
              onViewNavigationArrowClicked?.('left');
            }}
            onMouseEnter={() => setShowLeftArrowTooltip(true)}
            onMouseLeave={() => setShowLeftArrowTooltip(false)}
            disabled={!canScrollLeft}
            style={{ opacity: canScrollLeft ? 1 : 0.3, cursor: canScrollLeft ? 'pointer' : 'not-allowed' }}
        >
            <svg width="25" height="28" viewBox="0 0 25 28" fill="none">
              <path d="M17 23L8.34772 14.0494C8.15571 13.8507 8.16118 13.534 8.35992 13.3422L17 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
        </button>

        <button
            ref={rightArrowRef}
            className={styles.navArrowButton}
            onClick={() => {
              setShowRightArrowTooltip(false);
              onViewNavigationArrowClicked?.('right');
            }}
            onMouseEnter={() => setShowRightArrowTooltip(true)}
            onMouseLeave={() => setShowRightArrowTooltip(false)}
            disabled={!canScrollRight}
            style={{ opacity: canScrollRight ? 1 : 0.3, cursor: canScrollRight ? 'pointer' : 'not-allowed' }}
        >
            <svg width="25" height="28" viewBox="0 0 25 28" fill="none" style={{ transform: 'rotate(180deg)' }}>
              <path d="M17 23L8.34772 14.0494C8.15571 13.8507 8.16118 13.534 8.35992 13.3422L17 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
        </button>
    </div>
    );

    };

  return (
    <div className={`${styles.navBar} `} style={{ height: `${height}px` , marginTop: `${0}px`}}>
      <div className={styles.viewNavContent}>


       {renderArrows()}
        
        <div className={styles.horizontalScrollContainer}>
        <div
          ref={scrollBarRef}
          className={styles.horizontalScrollbar}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setShowThumbTooltip(true)}
          onMouseLeave={() => setShowThumbTooltip(false)}
        >
          <div
            ref={scrollThumbRef}
            className={styles.scrollbarThumb}
            style={{ left: `${scrollPercentage}%` }}
          />
        </div>
        </div>
        
        <button
          ref={eyeButtonRef}
          className={styles.eyeButton}
          onMouseEnter={() => setIsVisibilityMenuOpen(true)}
          onMouseLeave={() => {
            // Small delay to allow moving to menu
            setTimeout(() => {
              if (!menuRef.current?.matches(':hover')) {
                setIsVisibilityMenuOpen(false);
              }
            }, 100);
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
      
      <PhenExNavBarTooltip
        isVisible={showLeftArrowTooltip && canScrollLeft}
        anchorElement={leftArrowRef.current}
        verticalPosition='above'
        label="Go to Previous Parameter"
      />
      
      <PhenExNavBarTooltip
        isVisible={showRightArrowTooltip && canScrollRight}
        anchorElement={rightArrowRef.current}
        label="Go to Next Parameter"
        verticalPosition='above'
      />
      
      <PhenExNavBarTooltip
        isVisible={showThumbTooltip}
        anchorElement={scrollThumbRef.current}
        label="Scroll Through Parameters"
        verticalPosition='above'
      />
      
      <VisibilityMenu
        isOpen={isVisibilityMenuOpen}
        onClose={() => setIsVisibilityMenuOpen(false)}
        anchorElement={eyeButtonRef.current}
        menuRef={menuRef}
        onMouseEnter={() => setIsVisibilityMenuOpen(true)}
        onMouseLeave={() => setIsVisibilityMenuOpen(false)}
      />
    </div>
  );
};
