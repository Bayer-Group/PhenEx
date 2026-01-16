import React from 'react';
import styles from './NavBar.module.css';
import { CohortNavBar } from './CohortNavBar';
import { AddButtonNavBar } from './AddButtonNavBar';

interface TabsAndAddButtonProps {
  height: number;
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
  shadow?: boolean;
}

export const TabsAndAddButton: React.FC<TabsAndAddButtonProps> = ({ 
  height, 
  onSectionTabChange, 
  dragHandleRef,
  shadow = false 
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '15px' }}>
      <CohortNavBar 
        height={height} 
        onSectionTabChange={onSectionTabChange} 
        dragHandleRef={dragHandleRef}
        shadow={shadow}
      />
      <AddButtonNavBar 
        height={height} 
        onSectionTabChange={onSectionTabChange}
        dragHandleRef={dragHandleRef}
      />
    </div>
  );
};
