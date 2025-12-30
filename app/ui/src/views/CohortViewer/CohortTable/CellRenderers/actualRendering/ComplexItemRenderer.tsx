import React from 'react';
import styles from './ComplexItemRenderer.module.css';

export interface ComplexItemRendererProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onItemClick?: (item: T, index: number, event?: React.MouseEvent) => void;
  operator?: string; // Optional operator to display between items (e.g., "AND", "OR", "+")
  emptyPlaceholder?: React.ReactNode;
  itemClassName?: string; // Optional className to apply to each item wrapper
  selectedIndex?: number; // Index of the currently selected item (for visual highlighting)
  selectedClassName?: string; // Optional className to apply to the selected item
}

/**
 * ComplexItemRenderer - Generic wrapper for rendering arrays of complex items
 * Handles the layout, borders, operators, and click interactions consistently
 * 
 * @param items - Array of items to render
 * @param renderItem - Function to render each individual item
 * @param onItemClick - Callback when an item is clicked
 * @param operator - Optional operator to display between items
 * @param emptyPlaceholder - What to show when items array is empty
 * @param itemClassName - Optional className to apply to each item wrapper
 */
export function ComplexItemRenderer<T>({
  items,
  renderItem,
  onItemClick,
  operator,
  emptyPlaceholder = <div className={styles.empty}></div>,
  itemClassName,
  selectedIndex,
  selectedClassName,
}: ComplexItemRendererProps<T>) {
  
  if (!items || items.length === 0) {
    return <>{emptyPlaceholder}</>;
  }

  return (
    <div className={styles.container}>
      {items.map((item, index) => {
        const isSelected = selectedIndex !== undefined && selectedIndex === index;
        const itemClasses = `${styles.item} ${itemClassName || ''} ${isSelected && selectedClassName ? selectedClassName : ''}`;
        
        return (
          <React.Fragment key={index}>
            <div
              className={itemClasses}
              data-item-index={index}
              onClick={(e) => {
                e.stopPropagation();
                if (onItemClick) {
                  onItemClick(item, index, e);
                }
              }}
              style={{ cursor: onItemClick ? 'pointer' : 'default' }}
            >
              {renderItem(item, index)}
            </div>
            {operator && index < items.length - 1 && (
              <div className={styles.operator}>{operator}</div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
