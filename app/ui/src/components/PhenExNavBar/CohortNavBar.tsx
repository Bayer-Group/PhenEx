import React from 'react';
import styles from './NavBar.module.css';
import { Tabs } from '../ButtonsAndTabs/Tabs/Tabs';

interface CohortNavBarProps {
  height: number;
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
}

export const CohortNavBar: React.FC<CohortNavBarProps> = ({ height, onSectionTabChange, dragHandleRef }) => {
  const tabs = ['Cohort definition', 'Characteristics', 'Outcomes', 'All phenotypes'];

  return (
    <div className={styles.navBar} style={{ height: `${height}px` }}>
      <div ref={dragHandleRef} style={{ cursor: 'grab', userSelect: 'none', padding: '0 8px' }}>
        ⋮⋮
      </div>
      <Tabs
        width={400}
        height={height - 10}
        tabs={tabs}
        onTabChange={onSectionTabChange || (() => {})}
        active_tab_index={0}
        classNameTabs = {styles.classNameSectionTabs}
        classNameTabsContainer={styles.classNameTabsContainer}
      />
    </div>
  );
};
