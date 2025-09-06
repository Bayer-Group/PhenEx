import { FC, useState, useEffect, useRef } from 'react';
import { RightPanelHistoryDataService, RightPanelHistoryItem } from './RightPanelHistoryDataService';
import { TwoPanelCohortViewerService } from './TwoPanelCohortViewer';
import { HistoryCard } from './HistoryCard';
import { PositionedPortal } from '../../../components/Portal/PositionedPortal';
import styles from './RightPanelHistory.module.css';
import historyCardStyles from './HistoryCard.module.css';

interface RightPanelHistoryProps {
  className?: string;
}

export const RightPanelHistory: FC<RightPanelHistoryProps> = ({ className }) => {
  const historyService = RightPanelHistoryDataService.getInstance();
  const cohortViewerService = TwoPanelCohortViewerService.getInstance();
  const [history, setHistory] = useState<RightPanelHistoryItem[]>(historyService.getHistory());
  const [currentItem, setCurrentItem] = useState<RightPanelHistoryItem | null>(historyService.getCurrentItem());
  const [isHovered, setIsHovered] = useState(false);
  const [isSlideOut, setIsSlideOut] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxCards = 3; // Number of cards to display
  const AUTO_HIDE_DELAY = 300; // 2 seconds

  useEffect(() => {
    const updateHistory = () => {
      console.log('[RightPanelHistory] Updating history state');
      setHistory(historyService.getHistory());
      setCurrentItem(historyService.getCurrentItem());
      
      // Reset auto-hide timer when history updates
      resetAutoHideTimer();
    };

    // Initialize with current state
    updateHistory();
    
    historyService.addListener(updateHistory);
    return () => {
      historyService.removeListener(updateHistory);
      clearTimeouts();
    };
  }, [historyService]);

  // Auto-hide management
  const clearTimeouts = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const resetAutoHideTimer = () => {
    clearTimeouts();
    
    // Don't auto-hide if hovered
    if (isHovered) return;
    
    hideTimeoutRef.current = setTimeout(() => {
      setIsSlideOut(true);
      console.log('[RightPanelHistory] Auto-hiding after timeout');
    }, AUTO_HIDE_DELAY);
  };

  const handleMouseEnter = () => {
    console.log('[RightPanelHistory] Mouse entered');
    setIsHovered(true);
    setIsSlideOut(false);
    clearTimeouts();
  };

  const handleMouseLeave = () => {
    console.log('[RightPanelHistory] Mouse left');
    setIsHovered(false);
    
    // Start auto-hide timer again
    resetAutoHideTimer();
  };

  // Start auto-hide timer on mount and when history changes
  useEffect(() => {
    if (currentItem && history.length > 1 && !isHovered && !isSlideOut) {
      resetAutoHideTimer();
    }
    
    return () => clearTimeouts();
  }, [currentItem, history.length, isHovered, isSlideOut]);

  const handleCardClick = (item: RightPanelHistoryItem, index: number) => {
    console.log(`[RightPanelHistory] Card clicked at index ${index}:`, item.displayName);
    
    // Since we're showing previous items, index 0 is the most recent previous item
    // We need to pop (index + 1) times to reach the clicked item
    const popsNeeded = index + 1;
    
    for (let i = 0; i < popsNeeded; i++) {
      const previousItem = historyService.goBack();
      if (previousItem && i === popsNeeded - 1) {
        // On the last pop, update the view
        cohortViewerService.setCurrentViewAndData(previousItem.viewType, previousItem.extraData);
      }
    }
  };

  if (!currentItem || history.length <= 1) {
    console.log('[RightPanelHistory] No previous items to show, not rendering');
    return null;
  }

  // Get the previous N items for display (excluding the current item)
  // We want to show items we can go back to, not the current one
  const previousItems = history.slice(0, -1); // Remove current item
  const displayItems = previousItems.slice(-maxCards).reverse(); // Get last N, most recent first
  
  console.log('[RightPanelHistory] Rendering stack with previous items:', displayItems.map(item => item.displayName));
  console.log('[RightPanelHistory] isHovered:', isHovered); // Debug log

  return (
    <div 
      ref={containerRef}
      className={`${className || ''}`}
      style={{
        position: 'absolute',
        top: '0px',
        right: '0px',
        width: '1px',
        height: '1px',
        opacity: 0
      }}
    >
      <PositionedPortal triggerRef={containerRef} position="left" offsetX={0} offsetY={0} alignment="left">
        <div 
          className={`${styles.historyContainer}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className={`${styles.rightPanelHistory} ${isSlideOut ? styles.slideOut : styles.slideIn}`}>
            <div className={`${styles.cardStack} ${isHovered ? styles.hovered : ''}`}>
              {displayItems.map((item, index) => (
                <HistoryCard 
                  key={`${item.timestamp}-${index}`}
                  item={item}
                  index={index}
                  onClick={() => handleCardClick(item, index)}
                  className={isHovered ? historyCardStyles.cardHovered : ''}
                />
              ))}
            </div>
          </div>
        </div>
      </PositionedPortal>
    </div>
  );
};
