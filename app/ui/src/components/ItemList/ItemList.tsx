import React, { useState, useRef, useEffect } from 'react';
import { ListItem, ListItemProps } from './ListItem';
import styles from './ItemList.module.css';

export interface ItemListProps {
  items: ListItemProps[];
  selectedName?: string;
  onSelect?: (name: string) => void;
  classNameListItem?: string;
  classNameListItemSelected?: string;
  showFilter?: boolean; // If true, show search filter at top
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  selectedName,
  onSelect,
  classNameListItem,
  classNameListItemSelected,
  showFilter = false,
}) => {
  const [filterText, setFilterText] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Filter items based on search text
  const filteredItems = React.useMemo(() => {
    if (!filterText.trim()) {
      // No filter - sort to put selected item at top
      if (selectedName) {
        const selectedItem = items.find(item => item.name === selectedName);
        const otherItems = items.filter(item => item.name !== selectedName);
        return selectedItem ? [selectedItem, ...otherItems] : items;
      }
      return items;
    }
    // With filter - just filter, don't reorder
    const searchLower = filterText.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(searchLower) ||
      item.subtitle?.toLowerCase().includes(searchLower)
    );
  }, [items, filterText, selectedName]);

  // Reset highlighted index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filterText]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!showFilter) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we're not already in an input (except our filter input)
      const target = e.target as HTMLElement;
      const isFilterInput = target === filterInputRef.current;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[highlightedIndex]) {
          onSelect?.(filteredItems[highlightedIndex].name);
        }
      } else if (!isFilterInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Any printable character - focus filter and add to it
        filterInputRef.current?.focus();
        // The character will be added automatically by the browser
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilter, filteredItems, highlightedIndex, onSelect]);

  const handleClearFilter = () => {
    setFilterText('');
    filterInputRef.current?.focus();
  };

  return (
    <div className={styles.container}>
      {showFilter && (
        <div className={styles.filterContainer}>
          <input
            ref={filterInputRef}
            type="text"
            className={styles.filterInput}
            placeholder="filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />
          {filterText && (
            <button
              className={styles.clearButton}
              onClick={handleClearFilter}
              title="Clear filter"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div className={styles.itemsContainer}>
        {filteredItems.map((item, index) => (
          <ListItem
            key={item.name}
            {...item}
            selected={selectedName === item.name}
            highlighted={showFilter && index === highlightedIndex}
            onClick={() => onSelect?.(item.name)}
            classNameListItem={classNameListItem}
            classNameListItemSelected={classNameListItemSelected}
          />
        ))}
      </div>
    </div>
  );
};
