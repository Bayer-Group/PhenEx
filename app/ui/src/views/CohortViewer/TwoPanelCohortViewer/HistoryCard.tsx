import React, { FC } from 'react';
import { RightPanelHistoryItem } from './RightPanelHistoryDataService';
import styles from './HistoryCard.module.css';
import typeStyles from '../../../styles/study_types.module.css';

interface HistoryCardProps {
  item: RightPanelHistoryItem;
  index: number; // 0 = topmost card, higher = further back
  onClick?: () => void;
  className?: string;
  isHovered?: boolean;
}

export const HistoryCard: FC<HistoryCardProps> = ({ item, index, onClick, className, isHovered }) => {
  const hasExtraData = item.extraData && typeof item.extraData === 'object' && Object.keys(item.extraData).length > 0;
  const backgroundColor = hasExtraData ? undefined : 'var(--background-color)';
  const typeStyleClass = hasExtraData && item.extraData.class_name ? `typeStyles-${item.extraData.class_name}` : undefined;
  
  const cardClassName = [
    styles.historyCard,
    `${styles.cardIndex}${index}`, // Add specific index class for CSS targeting
    typeStyleClass,
    className,
    typeStyles[`${item.extraData?.effective_type || ''}_color_block_text_and_border`] || '',
    typeStyles[`${item.extraData?.effective_type || ''}_color_block_text_and_border`] || '',
    isHovered ? styles.cardHovered : '' // Apply cardHovered class when hovered
  ].filter(Boolean).join(' ');

  const cardStyle = {
    '--card-index': index,
    backgroundColor: backgroundColor
  } as React.CSSProperties;

  const displayTitle = hasExtraData ? item.displayName : item.viewType.charAt(0).toUpperCase() + item.viewType.slice(1);

  // Calculate font size based on text length and container width
  const calculateFontSize = (text: string): number => {
    const minSize = 10;
    const maxSize = 16;
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
