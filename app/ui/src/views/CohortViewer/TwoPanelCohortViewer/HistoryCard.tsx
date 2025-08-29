import React, { FC } from 'react';
import { RightPanelHistoryItem } from './RightPanelHistoryDataService';
import styles from './HistoryCard.module.css';
import typeStyles from '../../../styles/study_types.module.css';

interface HistoryCardProps {
  item: RightPanelHistoryItem;
  index: number; // 0 = topmost card, higher = further back
  onClick?: () => void;
  className?: string;
}

export const HistoryCard: FC<HistoryCardProps> = ({ item, index, onClick, className }) => {
  const hasExtraData = item.extraData && typeof item.extraData === 'object' && Object.keys(item.extraData).length > 0;
  const backgroundColor = hasExtraData ? undefined : 'var(--background-color)';
  const typeStyleClass = hasExtraData && item.extraData.class_name ? `typeStyles-${item.extraData.class_name}` : undefined;
  
  // Debug logging for extraData
  console.log('[HistoryCard] Debug - item:', item.displayName);
  console.log('[HistoryCard] Debug - extraData:', item.extraData);
  console.log('[HistoryCard] Debug - extraData type:', item.extraData?.type);
  console.log('[HistoryCard] Debug - hasExtraData:', hasExtraData);
  
  const cardClassName = [
    styles.historyCard,
    typeStyleClass,
    className,
    typeStyles[`${item.extraData?.type || ''}_text_color`] || ''
  ].filter(Boolean).join(' ');

  const cardStyle = {
    '--card-index': index,
    backgroundColor: backgroundColor
  } as React.CSSProperties;

  const displayTitle = hasExtraData ? item.displayName : item.viewType.charAt(0).toUpperCase() + item.viewType.slice(1);

  return (
    <div 
      className={cardClassName}
      style={cardStyle}
      onClick={onClick}
      title={`${item.displayName} - ${new Date(item.timestamp).toLocaleTimeString()}`}
    >
      <div className={`${styles.cardContent}`}>
        <div className={styles.cardTitle}>
          {displayTitle}
        </div>
        {/* {hasExtraData && (
          <div className={styles.cardSubtitle}>
            {item.viewType}
          </div>
        )} */}
      </div>
    </div>
  );
};
