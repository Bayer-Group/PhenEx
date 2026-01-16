import React, { useState } from 'react';
import styles from './PhenExNavBar.module.css';
import { ActionNavBar } from './ActionNavBar';
import { ViewNavBar } from './ViewNavBar';
import { NavBarMenuProvider } from './PhenExNavBarMenuContext';

interface PhenExNavBarProps {
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
  scrollPercentage?: number;
  canScrollLeft?: boolean;
  canScrollRight?: boolean;
  onViewNavigationArrowClicked?: (direction: 'left' | 'right') => void;
  onViewNavigationScroll?: (percentage: number) => void;
  onViewNavigationVisibilityClicked?: () => void;
}

export const PhenExNavBar: React.FC<PhenExNavBarProps> = ({
  onSectionTabChange,
  dragHandleRef,
  scrollPercentage,
  canScrollLeft,
  canScrollRight,
  onViewNavigationArrowClicked,
  onViewNavigationScroll,
  onViewNavigationVisibilityClicked,
}) => {
  const heightNavBar = 44;
  const [allHidden, setAllHidden] = useState(false);

  const handleHideNavBar = () => {
    setAllHidden(true);
  };

  const handleShowNavBar = () => {
    setAllHidden(false);
  };

  return (
    <NavBarMenuProvider>
      <div className={styles.topRight}>
        <ViewNavBar
          height={heightNavBar}
          scrollPercentage={scrollPercentage}
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          onViewNavigationArrowClicked={onViewNavigationArrowClicked}
          onViewNavigationScroll={onViewNavigationScroll}
          onViewNavigationVisibilityClicked={onViewNavigationVisibilityClicked}
        />
      </div>
      <div className={`${styles.phenexNavBar} ${allHidden ? styles.allHidden : ''}`}>

      </div>
      <div className={styles.bottomRight}>
        <ActionNavBar 
          height={heightNavBar}
          onHideNavBar={handleHideNavBar}
          onShowNavBar={handleShowNavBar}
        />
      </div>
    </NavBarMenuProvider>
  );
};
