import { FC, useState, useEffect } from 'react';
import styles from './Tabs.module.css';
import { CustomizableDropdownButton } from '../ButtonsBar/CustomizableDropdownButton';

interface TabsWithDropdownProps {
  width: string | number;
  height: string | number;
  tabs: string[];
  dropdown_items?: Record<number, React.ReactNode>;
  active_tab_index?: number;
  outline_tab_index?: number;
  onTabChange?: (index: number) => void;
  customizableDropdownButtonRef?: React.RefObject<{ closeDropdown: () => void }>;
}

export const TabsWithDropdown: FC<TabsWithDropdownProps> = ({
  width,
  height,
  tabs,
  dropdown_items,
  active_tab_index = 0,
  outline_tab_index = -1,
  onTabChange,
  customizableDropdownButtonRef,
}) => {
  const [activeTab, setActiveTab] = useState(active_tab_index);

  useEffect(() => {
    setActiveTab(active_tab_index);
  }, [active_tab_index]);

  const handleTabClick = (index: number) => {
    if (!dropdown_items || !(index in dropdown_items)) {
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
        if (dropdown_items && index in dropdown_items) {
          return (
            <CustomizableDropdownButton
              key={index}
              label={tab}
              content={dropdown_items[index]}
              ref={customizableDropdownButtonRef}
              outline={index === outline_tab_index}
            />
          );
        } else {
          return (
            <button
              key={index}
              className={`${styles.tab} ${index === activeTab ? styles.active : ''}  ${index === outline_tab_index ? styles.outline : ''}`}
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
