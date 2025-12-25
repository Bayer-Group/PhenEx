import React from 'react';
import styles from './NavBar.module.css';
import { Tabs } from '../ButtonsAndTabs/Tabs/Tabs';

interface CohortNavBarProps {
  height: number;
  onSectionTabChange?: (index: number) => void;
}

export const CohortNavBar: React.FC<CohortNavBarProps> = ({ height, onSectionTabChange }) => {
  const tabs = ['Cohort definition', 'Characteristics', 'Outcomes', 'All phenotypes'];

  return (
    <div className={styles.navBar} style={{ height: `${height}px` }}>
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
