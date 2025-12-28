import React from 'react';
import styles from './PhenExNavBar.module.css';
import { CohortNavBar } from './CohortNavBar';
import { ActionNavBar } from './ActionNavBar';
import { ViewNavBar } from './ViewNavBar';

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

  return (
    <div className={styles.phenexNavBar}>
      <CohortNavBar height={heightNavBar} onSectionTabChange={onSectionTabChange} dragHandleRef={dragHandleRef} />
      <ViewNavBar
        height={heightNavBar}
        scrollPercentage={scrollPercentage}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onViewNavigationArrowClicked={onViewNavigationArrowClicked}
        onViewNavigationScroll={onViewNavigationScroll}
        onViewNavigationVisibilityClicked={onViewNavigationVisibilityClicked}
      />
      <ActionNavBar height={heightNavBar} />

    </div>
  );
};
