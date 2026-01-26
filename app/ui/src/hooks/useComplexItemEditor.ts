import { useState, useCallback } from 'react';

export interface UseComplexItemEditorOptions<T> {
  initialValue: T | T[] | null | undefined;
  createNewItem: () => T;
  onValueChange?: (value: T[]) => void;
  clickedItemIndex?: number; // Index of item that was clicked to open editor
}

export interface UseComplexItemEditorReturn<T> {
  // State
  selectedItemIndex: number | null;
  editingItem: T | null;
  items: T[];
  
  // Actions
  handleItemSelect: (item: T, index?: number) => void;
  handleAddItem: () => void;
  handleItemChange: (newItem: T) => void;
  handleDeleteItem: (index: number) => void;
  handleEditingDone: () => void;
  
  // Computed
  isEditing: boolean;
}

/**
 * useComplexItemEditor - Shared hook for managing complex item editor state
 * Handles selection, editing, adding, and deleting items in a consistent way
 * 
 * @param options - Configuration for the hook
 * @returns State and handlers for complex item editing
 */
export function useComplexItemEditor<T>({
  initialValue,
  createNewItem,
  onValueChange,
  clickedItemIndex,
}: UseComplexItemEditorOptions<T>): UseComplexItemEditorReturn<T> {
  
  // Convert initial value to array
  const normalizeToArray = (value: T | T[] | null | undefined): T[] => {
    if (Array.isArray(value)) {
      // Filter out any invalid items
      return value.filter(item => 
        item != null && 
        typeof item === 'object' && 
        typeof item !== 'string'
      );
    }
    if (value != null && typeof value === 'object' && typeof value !== 'string') {
      return [value as T];
    }
    return [];
  };

  // Hook manages its own items state - this is the source of truth during editing
  const [items, setItems] = useState<T[]>(() => {
    const normalized = normalizeToArray(initialValue);
    console.log('useComplexItemEditor: initializing items state', {
      initialValue,
      normalized,
      normalizedLength: normalized.length,
    });
    return normalized;
  });
  
  // Auto-select based on clickedItemIndex or if there's exactly one item
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(() => {
    const initial = normalizeToArray(initialValue);
    console.log('useComplexItemEditor: initializing selectedItemIndex', {
      clickedItemIndex,
      initialLength: initial.length,
      willAutoSelect: initial.length === 1,
    });
    if (clickedItemIndex !== undefined && clickedItemIndex < initial.length) {
      return clickedItemIndex;
    }
    return initial.length === 1 ? 0 : null;
  });
  const [editingItem, setEditingItem] = useState<T | null>(() => {
    const initial = normalizeToArray(initialValue);
    const item = clickedItemIndex !== undefined && clickedItemIndex < initial.length
      ? initial[clickedItemIndex]
      : initial.length === 1 ? initial[0] : null;
    console.log('useComplexItemEditor: initializing editingItem', {
      item,
      fromClickedIndex: clickedItemIndex !== undefined && clickedItemIndex < initial.length,
      autoSelected: initial.length === 1,
    });
    return item;
  });

  const handleItemSelect = useCallback((item: T, index?: number) => {
    const actualIndex = index ?? 0;
    console.log('=== Complex item selected ===');
    console.log('Item:', item);
    console.log('Index:', actualIndex);
    
    // Unwrap flattened item structure if needed (from LogicalFilterRenderer)
    // @ts-ignore - checking for flattened item structure
    const actualItem = item?.filter ? item.filter : item;
    console.log('Unwrapped item:', actualItem);
    
    setSelectedItemIndex(actualIndex);
    setEditingItem(actualItem);
  }, []);

  const handleAddItem = useCallback(() => {
    console.log('=== Add complex item clicked ===');
    const newItem = createNewItem();
    console.log('Created new item:', newItem);
    const currentItems = items;
    console.log('Current items before add:', currentItems);
    const newIndex = currentItems.length;
    console.log('New index will be:', newIndex);
    
    // Add the new item to the array
    const updatedItems = [...currentItems, newItem];
    console.log('Updated items array:', updatedItems);
    setItems(updatedItems);
    onValueChange?.(updatedItems);
    
    // Select it for editing
    console.log('Setting editingItem to:', newItem);
    console.log('Setting selectedItemIndex to:', newIndex);
    setEditingItem(newItem);
    setSelectedItemIndex(newIndex);
  }, [createNewItem, items, onValueChange]);

  const handleItemChange = useCallback((newItem: T) => {
    console.log('=== Complex item changed ===');
    console.log('New item:', newItem);
    console.log('Selected index:', selectedItemIndex);
    
    if (selectedItemIndex !== null) {
      // Update the items array
      const currentItems = items;
      const updatedItems = [...currentItems];
      console.log('Updating index', selectedItemIndex, 'in array:', currentItems);
      updatedItems[selectedItemIndex] = newItem;
      console.log('Updated items array:', updatedItems);
      setItems(updatedItems);
      onValueChange?.(updatedItems);
      
      // Update local editing state
      setEditingItem(newItem);
    } else {
      console.warn('selectedItemIndex is null, cannot update item!');
    }
  }, [selectedItemIndex, items, onValueChange]);

  const handleDeleteItem = useCallback((index: number) => {
    console.log('Delete complex item at index:', index);
    const currentItems = items;
    const updatedItems = currentItems.filter((_, i) => i !== index);
    
    setItems(updatedItems);
    onValueChange?.(updatedItems);
    
    // Clear selection if we deleted the selected item
    if (selectedItemIndex === index) {
      setSelectedItemIndex(null);
      setEditingItem(null);
    }
  }, [items, selectedItemIndex, onValueChange]);

  const handleEditingDone = useCallback(() => {
    console.log('=== Editing done, clearing selection ===');
    setSelectedItemIndex(null);
    setEditingItem(null);
  }, []);

  return {
    selectedItemIndex,
    editingItem,
    items,
    handleItemSelect,
    handleAddItem,
    handleItemChange,
    handleDeleteItem,
    handleEditingDone,
    isEditing: selectedItemIndex !== null && editingItem !== null,
  };
}
