import React from 'react';
import styles from './NavBar.module.css';
import { CohortNavBar, MenuItem } from './CohortNavBar';
import { AddButtonNavBar } from './AddButtonNavBar';

interface TabsAndAddButtonProps {
  height: number;
  mode?: 'cohortviewer' | 'studyviewer';
  onSectionTabChange?: (index: number) => void;
  onButtonClick?: () => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
  shadow?: boolean;
  menuItems?: MenuItem[];
}

export const TabsAndAddButton: React.FC<TabsAndAddButtonProps> = ({ 
  height,
  mode = 'cohortviewer',
  onSectionTabChange,
  onButtonClick,
  dragHandleRef,
  shadow = false,
  menuItems 
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '15px' }}>
      <CohortNavBar 
        height={height} 
        onSectionTabChange={onSectionTabChange} 
        dragHandleRef={dragHandleRef}
        shadow={shadow}
        menuItems={menuItems}
      />
      <AddButtonNavBar 
        height={height}
        mode={mode}
        onSectionTabChange={onSectionTabChange}
        onButtonClick={onButtonClick}
        dragHandleRef={dragHandleRef}
      />
    </div>
  );
};
