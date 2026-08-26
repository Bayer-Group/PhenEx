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
  const [items, setItems] = useState<T[]>(() => normalizeToArray(initialValue));
  
  // Auto-select based on clickedItemIndex or if there's exactly one item
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(() => {
    const initial = normalizeToArray(initialValue);
    if (clickedItemIndex !== undefined && clickedItemIndex < initial.length) {
      return clickedItemIndex;
    }
    return initial.length === 1 ? 0 : null;
  });
  const [editingItem, setEditingItem] = useState<T | null>(() => {
    const initial = normalizeToArray(initialValue);
    if (clickedItemIndex !== undefined && clickedItemIndex < initial.length) {
      return initial[clickedItemIndex];
    }
    return initial.length === 1 ? initial[0] : null;
  });

  const handleItemSelect = useCallback((item: T, index?: number) => {
    const actualIndex = index ?? 0;
    
    // Unwrap flattened item structure if needed (from LogicalFilterRenderer)
    // @ts-ignore - checking for flattened item structure
    const actualItem = item?.filter ? item.filter : item;
    
    setSelectedItemIndex(actualIndex);
    setEditingItem(actualItem);
  }, []);

  const handleAddItem = useCallback(() => {
    const newItem = createNewItem();
    const currentItems = items;
    const newIndex = currentItems.length;
    
    // Add the new item to the array
    const updatedItems = [...currentItems, newItem];
    setItems(updatedItems);
    onValueChange?.(updatedItems);
    
    // Select it for editing
    setEditingItem(newItem);
    setSelectedItemIndex(newIndex);
  }, [createNewItem, items, onValueChange]);

  const handleItemChange = useCallback((newItem: T) => {
    if (selectedItemIndex !== null) {
      // Update the items array
      const currentItems = items;
      const updatedItems = [...currentItems];
      updatedItems[selectedItemIndex] = newItem;
      setItems(updatedItems);
      onValueChange?.(updatedItems);
      
      // Update local editing state
      setEditingItem(newItem);
    }
  }, [selectedItemIndex, items, onValueChange]);

  const handleDeleteItem = useCallback((index: number) => {
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
