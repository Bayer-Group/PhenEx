import React from 'react';
import styles from './PhenExNavBar.module.css';
import { CohortNavBar } from './CohortNavBar';
import { ActionNavBar } from './ActionNavBar';
import { ViewNavBar } from './ViewNavBar';

interface PhenExNavBarProps {
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
  onViewNavigationArrowClicked?: (direction: 'left' | 'right') => void;
  onViewNavigationScroll?: (percentage: number) => void;
  onViewNavigationVisibilityClicked?: () => void;
}

export const PhenExNavBar: React.FC<PhenExNavBarProps> = ({
  onSectionTabChange,
  dragHandleRef,
  onViewNavigationArrowClicked,
  onViewNavigationScroll,
  onViewNavigationVisibilityClicked,
}) => {
  const heightNavBar = 40;

  return (
    <div className={styles.phenexNavBar}>
      <CohortNavBar height={heightNavBar} onSectionTabChange={onSectionTabChange} dragHandleRef={dragHandleRef} />
      <ActionNavBar height={heightNavBar} />
      <ViewNavBar
        height={heightNavBar}
        onViewNavigationArrowClicked={onViewNavigationArrowClicked}
        onViewNavigationScroll={onViewNavigationScroll}
        onViewNavigationVisibilityClicked={onViewNavigationVisibilityClicked}
      />
    </div>
  );
};
