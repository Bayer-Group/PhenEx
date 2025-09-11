import { FC, useState, useEffect } from 'react';
import styles from './Tabs.module.css';

interface TabsProps {
  width?: string | number;
  height?: string | number;
  tabs: string[];
  active_tab_index?: number;
  onTabChange?: (index: number) => void;
  accentColor?: string;
  classNameTabs?: string;
  classNameTabsContainer?: string;
  icons?: { [key: number]: string };
}

export const Tabs: FC<TabsProps> = ({
    width,
    height,
    tabs,
    active_tab_index = 0,
    onTabChange,
    accentColor,
    classNameTabs = '',
    classNameTabsContainer = '',
    icons = {}
  }) => {
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

  // Create CSS custom properties for dynamic accent color
  const containerStyle = {
    '--dynamic-accent-color': accentColor || 'var(--color-accent-bright)',
  } as React.CSSProperties;

  return (
    <div className={`${styles.tabsContainer} ${classNameTabsContainer}`} style={containerStyle}>
      {tabs.map((tab, index) => (
        <button
          key={index}
          className={`${styles.tab} ${index === activeTab ? styles.active : ''} ${classNameTabs}`}
          onClick={() => handleTabClick(index)}
        >
            {icons && icons[index]
              ? <img src={icons[index]} alt={tab} style={{ height: '1em', verticalAlign: 'middle' }} />
              : tab}
        </button>
      ))}
    </div>
  );
};
