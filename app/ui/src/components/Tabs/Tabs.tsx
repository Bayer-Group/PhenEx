import { FC, useState, useEffect } from 'react';
import styles from './Tabs.module.css';

interface TabsProps {
  width: string | number;
  height: string | number;
  tabs: string[];
  active_tab_index?: number;
  onTabChange?: (index: number) => void;
}

export const Tabs: FC<TabsProps> = ({ width, height, tabs, active_tab_index = 0, onTabChange }) => {
  const [activeTab, setActiveTab] = useState(active_tab_index);

  useEffect(() => {
    setActiveTab(active_tab_index);
  }, [active_tab_index]);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
    if (onTabChange) {
      onTabChange(index);
    }
  };

  return (
    <div
      className={styles.tabsContainer}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      {tabs.map((tab, index) => (
        <button
          key={index}
          className={`${styles.tab} ${index === activeTab ? styles.active : ''}`}
          onClick={() => handleTabClick(index)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};
