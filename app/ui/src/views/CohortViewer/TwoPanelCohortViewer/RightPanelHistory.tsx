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
  const [lastItem, setLastItem] = useState<RightPanelHistoryItem | null>(historyService.getLastItem());

  useEffect(() => {
    const updateHistory = () => {
      console.log('[RightPanelHistory] Updating history state');
      setHistory(historyService.getHistory());
      setLastItem(historyService.getLastItem());
    };

    // Initialize with current state
    updateHistory();
    
    historyService.addListener(updateHistory);
    return () => historyService.removeListener(updateHistory);
  }, [historyService]);

  const handleClick = () => {
    console.log('[RightPanelHistory] Back button clicked');
    const previousItem = historyService.getPreviousItem();
    if (previousItem) {
      console.log('[RightPanelHistory] Navigating to previous item:', previousItem.displayName);
      cohortViewerService.displayExtraContent(previousItem.viewType, previousItem.extraData);
    } else {
      console.log('[RightPanelHistory] No previous item available');
    }
  };

  // Check if we can go back (more than 1 item in history)
  const canGoBack = history.length > 1;

  if (!lastItem) {
    console.log('[RightPanelHistory] No last item, not rendering');
    return null;
  }

  console.log('[RightPanelHistory] Rendering with last item:', lastItem.displayName, 'canGoBack:', canGoBack);

  return (
    <div className={styles.rightPanelHistory}>
      <button
        onClick={handleClick}
        className={`history-button ${!canGoBack ? 'disabled' : ''}`}
        title={canGoBack ? `Go back to previous panel` : 'No previous panel available'}
        disabled={!canGoBack}
      >
        <div className="history-icon">
          ←
        </div>
        <div className="history-text">
          Back ({history.length} items)
        </div>
      </button>
    </div>
  );
};
