import React, { useState } from 'react';
import styles from './InfoPanel.module.css';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { CohortTextArea } from './CohortTextArea/CohortTextArea';
import { TabsWithDropdown } from '../../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';

export const InfoPanel: React.FC = () => {
  const [tabs] = useState<string[]>(['Description', 'Sharing', 'Settings']);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);

  const handleTabChange = (index: number) => {
    setActiveTabIndex(index);
  };

  const infoContent = () => {
    return (
      <span>
        <i>Information panel with rich text editor</i>
        <ul>
          <li>
            Use this panel to <em>create and edit notes</em> with rich text formatting
          </li>
          <li>
            The editor supports <em>bold, italic, lists, headers</em> and more formatting options
          </li>
          <li>
            Perfect for <em>documentation, notes, or detailed information</em> that needs formatting
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
  }

  const renderDescription = () => {
    return (
      <div>
        <CohortTextArea />
      </div>
    );
  };

  const renderSharing = () => {
    return (
      <div>
        <p>This is the sharing content for the Info panel.</p>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div>
        <p>This is the settings content for the Info panel.</p>
      </div>
    );
  };

  return (
    <SlideoverPanel title="Info" info={infoContent()}>
      <div className={styles.container}>
        {renderTabs()}
        <div className={styles.editorWrapper}>
          {activeTabIndex === 0 && renderDescription()}
          {activeTabIndex === 1 && renderSharing()}
          {activeTabIndex === 2 && renderSettings()}
        </div>
      </div>
    </SlideoverPanel>
  );
};
