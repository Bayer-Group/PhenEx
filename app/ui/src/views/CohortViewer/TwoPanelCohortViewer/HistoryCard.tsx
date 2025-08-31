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
    `${styles.cardIndex}${index}`, // Add specific index class for CSS targeting
    typeStyleClass,
    className,
    typeStyles[`${item.extraData?.type || ''}_color_block`] || '',
    typeStyles[`${item.extraData?.type || ''}_border_color`] || ''

  ].filter(Boolean).join(' ');

  // Debug logging for classes
  console.log('[HistoryCard] Debug - index:', index);
  console.log('[HistoryCard] Debug - className prop:', className);
  console.log('[HistoryCard] Debug - final cardClassName:', cardClassName);
  console.log('[HistoryCard] Debug - cardIndex class:', `${styles.cardIndex}${index}`);

  const cardStyle = {
    '--card-index': index,
    backgroundColor: backgroundColor
  } as React.CSSProperties;

  const displayTitle = hasExtraData ? item.displayName : item.viewType.charAt(0).toUpperCase() + item.viewType.slice(1);

  // Calculate font size based on text length and container width
  const calculateFontSize = (text: string): number => {
    const minSize = 12;
    const maxSize = 19;
    const containerWidth = 120; // Available width after padding (150px - 30px padding)
    
    // More conservative character width estimates for different font sizes
    const getCharWidth = (fontSize: number): number => {
      // Character width scales roughly with font size for this font family
      return fontSize * 0.55; // Empirical ratio for IBMPlexSans-bold
    };
    
    // Start with max size and check if it fits
    for (let fontSize = maxSize; fontSize >= minSize; fontSize--) {
      const charWidth = getCharWidth(fontSize);
      const charsPerLine = Math.floor(containerWidth / charWidth);
      const totalCapacity = charsPerLine * 2; // 2 lines available
      
      if (text.length <= totalCapacity) {
        return fontSize;
      }
    }
    
    return minSize;
  };

  const fontSize = calculateFontSize(displayTitle);

  return (
    <div 
      className={cardClassName}
      style={cardStyle}
      onClick={onClick}
      title={`${item.displayName}`}
    >
      <div className={`${styles.cardContent}`}>
        <span className={styles.backButton}>{'<'}</span>
        <span className={styles.cardTitle} style={{ fontSize: `${fontSize}px` }}>
          
           {displayTitle}
        </span>
        {/* {hasExtraData && (
          <div className={styles.cardSubtitle}>
            {item.viewType}
          </div>
        )} */}
      </div>
    </div>
  );
};
