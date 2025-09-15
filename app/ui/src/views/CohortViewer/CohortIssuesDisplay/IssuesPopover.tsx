import React, { useState, useRef } from 'react';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import styles from './IssuesPopover.module.css';
import { CohortIssue } from './CohortIssuesDisplay';
import { ChatPanel } from '../../ChatPanel/ChatPanel'
import BirdIcon from '../../../assets/bird_icon.png'
import { SimpleCustomScrollbar } from '../../../components/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { ResizableContainer } from '../../../components/ResizableContainer';
import IssuesPopoverList from './IssuesPopoverList';

interface IssuesPopoverProps {
  issues: CohortIssue[];
  onClose?: () => void; // Add back onClose prop for X button
  dragHandleRef?: React.RefObject<HTMLDivElement | null>; // Ref for the drag handle
}

export const IssuesPopover: React.FC<IssuesPopoverProps> = ({ issues, onClose, dragHandleRef }) => {
  const ISSUEPOPOVER_TABS = ['phenex', 'issues'];
  const [activeTabIndex, setActiveTabIndex] = useState(ISSUEPOPOVER_TABS.length - 1);
  const selectedView = ISSUEPOPOVER_TABS[activeTabIndex];
  const bodyRef = useRef<HTMLDivElement>(null);

  const onTabChange = (index: number) => {
    setActiveTabIndex(index);
  };

  const renderTabs = () => (
    <Tabs
      tabs={ISSUEPOPOVER_TABS}
      active_tab_index={activeTabIndex}
      onTabChange={onTabChange}
      classNameTabsContainer={styles.tabsContainer}
      classNameTabs={styles.tab}
      icons={{ 0: BirdIcon }}
    />
  );

  const renderCloseButton = () => (
    <button
      className={styles.customCloseButton}
      onClick={() => {
        if (onClose) onClose();
      }}
    >
      ×
    </button>
  );

  const renderTransparentHeader = () => (
    <div ref={dragHandleRef} className={styles.transparentHeader}>
      <div className={styles.transparentHeaderGradient} />
      {renderCloseButton()}
      {renderTabs()}
    </div>
  );

  return (
    <ResizableContainer
      className={styles.resizablePopover}
      initialWidth={400}
      initialHeight={window.innerHeight*3/4}
      minWidth={300}
      minHeight={250}
      maxWidth={1200}
      maxHeight={window.innerHeight - 200} // Match original calc(100vh - 200px)
      enableResize={{
        top: true,
        right: true,
        bottom: true,
        left: true,
      }}
    >
      <div className={`${styles.popover} ${issues.length === 0 ? styles.noIssues : ''}`}>
        {renderTransparentHeader()}
        {selectedView === 'issues' ? (
          <div ref={bodyRef} className={styles.body}><IssuesPopoverList issues={issues} /></div>
        ) : (
          <div ref={bodyRef} className={styles.body}>
            <ChatPanel/>
          </div>
        )}
        <SimpleCustomScrollbar 
          targetRef={bodyRef}
          orientation="vertical"
          marginTop={100}
          marginBottom={20}
          classNameThumb={styles.customScrollbarThumb}
        />
      </div>
    </ResizableContainer>
  );
};
