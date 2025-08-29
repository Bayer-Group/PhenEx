import React, { FC, useState, useEffect } from 'react';
import { RightPanelHistoryDataService, RightPanelHistoryItem } from './RightPanelHistoryDataService';
import { TwoPanelCohortViewerService } from './TwoPanelCohortViewer';
import { HistoryCard } from './HistoryCard';
import styles from './RightPanelHistory.module.css';

interface RightPanelHistoryProps {
  className?: string;
}

export const RightPanelHistory: FC<RightPanelHistoryProps> = ({ className }) => {
  const historyService = RightPanelHistoryDataService.getInstance();
  const cohortViewerService = TwoPanelCohortViewerService.getInstance();
  const [history, setHistory] = useState<RightPanelHistoryItem[]>(historyService.getHistory());
  const [currentItem, setCurrentItem] = useState<RightPanelHistoryItem | null>(historyService.getCurrentItem());

  const maxCards = 3; // Number of cards to display

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

  const handleCardClick = (item: RightPanelHistoryItem, index: number) => {
    console.log(`[RightPanelHistory] Card clicked at index ${index}:`, item.displayName);
    
    // If clicking the current item (index 0), do nothing
    if (index === 0) return;
    
    // Pop items until we reach the clicked item
    for (let i = 0; i < index; i++) {
      const previousItem = historyService.goBack();
      if (previousItem) {
        cohortViewerService.setCurrentViewAndData(previousItem.viewType, previousItem.extraData);
      }
    }
  };

  if (!currentItem) {
    console.log('[RightPanelHistory] No current item, not rendering');
    return null;
  }

  // Get the last N items for display (most recent first)
  const displayItems = history.slice(-maxCards).reverse();
  
  console.log('[RightPanelHistory] Rendering stack with items:', displayItems.map(item => item.displayName));

  return (
    <div className={`${styles.rightPanelHistory} ${className || ''}`}>
      <div className={styles.cardStack}>
        {displayItems.map((item, index) => (
          <HistoryCard 
            key={`${item.timestamp}-${index}`}
            item={item}
            index={index}
            onClick={() => handleCardClick(item, index)}
          />
        ))}
      </div>
    </div>
  );
};
