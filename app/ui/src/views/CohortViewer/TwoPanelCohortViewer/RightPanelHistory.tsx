import React, { FC, useState, useEffect } from 'react';
import { RightPanelHistoryDataService, RightPanelHistoryItem } from './RightPanelHistoryDataService';
import { TwoPanelCohortViewerService } from './TwoPanelCohortViewer';
import styles from './RightPanelHistory.module.css'
interface RightPanelHistoryProps {
  className?: string;
}

export const RightPanelHistory: FC<RightPanelHistoryProps> = ({ className }) => {
  const historyService = RightPanelHistoryDataService.getInstance();
  const cohortViewerService = TwoPanelCohortViewerService.getInstance();
  const [history, setHistory] = useState<RightPanelHistoryItem[]>(historyService.getHistory());
  const [currentItem, setCurrentItem] = useState<RightPanelHistoryItem | null>(historyService.getCurrentItem());

  useEffect(() => {
    const updateHistory = () => {
      console.log('[RightPanelHistory] Updating history state');
      setHistory(historyService.getHistory());
      setCurrentItem(historyService.getCurrentItem());
    };

    // Initialize with current state
    updateHistory();
    
    historyService.addListener(updateHistory);
    return () => historyService.removeListener(updateHistory);
  }, [historyService]);

  const handleBackClick = () => {
    console.log('[RightPanelHistory] Back button clicked');
    const previousItem = historyService.goBack();
    if (previousItem) {
      console.log('[RightPanelHistory] Navigating to previous item:', previousItem.displayName);
      // Don't call displayExtraContent as that would add to history
      // Instead, directly update the service state
      cohortViewerService.setCurrentViewAndData(previousItem.viewType, previousItem.extraData);
    } else {
      console.log('[RightPanelHistory] No previous item available');
    }
  };

  const handleForwardClick = () => {
    console.log('[RightPanelHistory] Forward button clicked');
    const nextItem = historyService.goForward();
    if (nextItem) {
      console.log('[RightPanelHistory] Navigating to next item:', nextItem.displayName);
      // Don't call displayExtraContent as that would add to history
      // Instead, directly update the service state
      cohortViewerService.setCurrentViewAndData(nextItem.viewType, nextItem.extraData);
    } else {
      console.log('[RightPanelHistory] No next item available');
    }
  };

  // Check navigation availability
  const canGoBack = historyService.canGoBack();
  const canGoForward = historyService.canGoForward();

  if (!currentItem) {
    console.log('[RightPanelHistory] No current item, not rendering');
    return null;
  }

  console.log('[RightPanelHistory] Rendering with current item:', currentItem.displayName, 'canGoBack:', canGoBack, 'canGoForward:', canGoForward);

  return (
    <div className={styles.rightPanelHistory}>
      <button
        onClick={handleBackClick}
        className={`history-button ${!canGoBack ? 'disabled' : ''}`}
        title={canGoBack ? `Go back to previous panel` : 'No previous panel available'}
        disabled={!canGoBack}
      >
        <div className="history-icon">
          ←
        </div>
        <div className="history-text">
          Back
        </div>
      </button>
      
      <button
        onClick={handleForwardClick}
        className={`history-button ${!canGoForward ? 'disabled' : ''}`}
        title={canGoForward ? `Go forward to next panel` : 'No next panel available'}
        disabled={!canGoForward}
      >
        <div className="history-icon">
          →
        </div>
        <div className="history-text">
          Forward
        </div>
      </button>
      
      <div className="history-info">
        {currentItem.displayName} ({history.length} items)
      </div>
    </div>
  );
};
