import React, { useState } from 'react';
import styles from './InfoPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { CohortTextArea } from './CohortTextArea/CohortTextArea';
import { CohortSettingsEditor } from './CohortSettingsEditor/CohortSettingsEditor';
import { TabsWithDropdown } from '../../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';

export const InfoPanel: React.FC = () => {
  const [tabs] = useState<string[]>(['Description', 'Settings']);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);

  const handleTabChange = (index: number) => {
    setActiveTabIndex(index);
  };

  const infoContent = () => {
    return (
      <span>
        <i>Document your cohort and access settings</i>
        <ul>
          <li>
            <em>Document your cohort</em> in the description tab using the the rich text editor. You
            can even ask AI to check that your description is properly implemented.
          </li>
          <li>
            <em>Share and export your cohort</em> in the share tab.
          </li>
          <li>
            <em>Delete your cohort</em> in the settings tab.
          </li>
        </ul>
      </span>
    );
  };

  const renderTabs = () => {
    return (
      <div className={styles.tabsContainer}>
        <TabsWithDropdown
          width="auto"
          height="auto"
          tabs={tabs}
          active_tab_index={activeTabIndex}
          onTabChange={handleTabChange}
        />
      </div>
    );
  };

  const renderDescription = () => {
    return (
      <div>
        <CohortTextArea />
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div>
        <CohortSettingsEditor />
      </div>
    );
  };

  return (
    <SlideoverPanel title="Description" info={infoContent()}>
      <div className={styles.container}>
        <div className={styles.bottomContainer}>
          {activeTabIndex === 0 && renderDescription()}
          {activeTabIndex === 1 && renderSettings()}
        </div>
      </div>
    </SlideoverPanel>
  );
};
