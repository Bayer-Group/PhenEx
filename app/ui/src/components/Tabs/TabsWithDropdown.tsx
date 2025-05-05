import { FC, useState, useEffect } from 'react';
import styles from './Tabs.module.css';
import { CustomizableDropdownButton } from '../ButtonsBar/CustomizableDropdownButton';

interface TabsWithDropdownProps {
  width: string | number;
  height: string | number;
  tabs: string[];
  dropdown_items: Record<number, React.ReactNode>;
  active_tab_index?: number;
  onTabChange?: (index: number) => void;
}

export const TabsWithDropdown: FC<TabsWithDropdownProps> = ({
  width,
  height,
  tabs,
  dropdown_items,
  active_tab_index = 0,
  onTabChange,
  onDropdownSelection,
}) => {
  const [activeTab, setActiveTab] = useState(active_tab_index);

  useEffect(() => {
    setActiveTab(active_tab_index);
  }, [active_tab_index]);

  const handleTabClick = (index: number) => {
    if (!dropdown_items[index]) {
      setActiveTab(index);
      if (onTabChange) {
        onTabChange(index);
      }
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
      {tabs.map((tab, index) => {
        if (index in dropdown_items) {
          return (
            <CustomizableDropdownButton key={index} label={tab} content={dropdown_items[index]} />
          );
        } else {
          return (
            <button
              key={index}
              className={`${styles.tab} ${index === activeTab ? styles.active : ''}`}
              onClick={() => handleTabClick(index)}
            >
              {tab}
            </button>
          );
        }
      })}
    </div>
  );
};
