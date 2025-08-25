import { FC, useState, useEffect } from 'react';
import { Tabs } from './Tabs';
import styles from './Tabs.module.css';
import { CustomizableDropdownButton } from '../ButtonsBar/CustomizableDropdownButton';

interface TabsWithDropdownProps {
  width?: string | number;
  height?: string | number;
  tabs: string[];
  dropdown_items?: Record<number, React.ReactNode>;
  active_tab_index?: number;
  outline_tab_index?: number;
  onTabChange?: (index: number) => void;
  customizableDropdownButtonRef?: React.RefObject<{ closeDropdown: () => void }>;
  accentColor?: string;
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
  accentColor,
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

  // If no dropdown items, just use the base Tabs component
  if (!dropdown_items || Object.keys(dropdown_items).length === 0) {
    return (
      <Tabs
        width={width}
        height={height}
        tabs={tabs}
        active_tab_index={active_tab_index}
        onTabChange={onTabChange}
        accentColor={accentColor}
      />
    );
  }

  // Create CSS custom properties for dynamic accent color
  const containerStyle = {
    '--dynamic-accent-color': accentColor || 'var(--color-accent-bright)',
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  } as React.CSSProperties;

  return (
    <div className={styles.tabsContainer} style={containerStyle}>
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
              className={`${styles.tab} ${index === activeTab ? styles.active : ''} ${index === outline_tab_index ? styles.outline : ''}`}
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
