import React from 'react';
import styles from './ComplexItemRenderer.module.css';

export interface ComplexItemRendererProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onItemClick?: (item: T, index: number) => void;
  operator?: string; // Optional operator to display between items (e.g., "AND", "OR", "+")
  emptyPlaceholder?: React.ReactNode;
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
 */
export function ComplexItemRenderer<T>({
  items,
  renderItem,
  onItemClick,
  operator,
  emptyPlaceholder = <div className={styles.empty}></div>,
}: ComplexItemRendererProps<T>) {
  
  if (!items || items.length === 0) {
    return <>{emptyPlaceholder}</>;
  }

  return (
    <div className={styles.container}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <div
            className={styles.item}
            onClick={(e) => {
              e.stopPropagation();
              if (onItemClick) {
                onItemClick(item, index);
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
      ))}
    </div>
  );
}
