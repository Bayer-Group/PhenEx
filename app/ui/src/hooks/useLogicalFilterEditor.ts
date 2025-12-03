import { useState, useCallback, useMemo } from 'react';

// Generic interfaces for logical filter trees
export interface LogicalAndFilter<T> {
  class_name: 'AndFilter';
  filter1: LogicalFilterTree<T>;
  filter2: LogicalFilterTree<T>;
}

export interface LogicalOrFilter<T> {
  class_name: 'OrFilter';
  filter1: LogicalFilterTree<T>;
  filter2: LogicalFilterTree<T>;
}

export type LogicalFilterTree<T> = T | LogicalAndFilter<T> | LogicalOrFilter<T>;

// Flattened representation for rendering
export interface FilterItem<T> {
  type: 'filter';
  filter: T;
  index: number; // Unique index for selection
  path: number[]; // Path in tree for operations
}

export interface OperatorItem {
  type: 'operator';
  operator: 'AND' | 'OR';
  index: number;
  path: number[]; // Path to the logical node in tree
}

export interface ParenthesisItem {
  type: 'parenthesis';
  paren: '(' | ')';
  index: number;
}

export type FlattenedItem<T> = FilterItem<T> | OperatorItem | ParenthesisItem;

export interface UseLogicalFilterEditorOptions<T> {
  initialValue: LogicalFilterTree<T> | null | undefined;
  createNewItem: () => T;
  onValueChange?: (value: LogicalFilterTree<T>) => void;
  isLeafNode: (value: any) => value is T; // Type guard to identify leaf nodes
}

export interface UseLogicalFilterEditorReturn<T> {
  // State
  selectedItemIndex: number | null;
  editingItem: T | null;
  filterTree: LogicalFilterTree<T>;
  flattenedItems: FlattenedItem<T>[];
  
  // Actions
  handleItemSelect: (item: FlattenedItem<T>) => void;
  handleOperatorToggle: (path: number[]) => void;
  handleAddFilter: (logicalOp: 'AND' | 'OR') => void;
  handleItemChange: (newItem: T) => void;
  handleDeleteItem: (path: number[]) => void;
  handleEditingDone: () => void;
  
  // Computed
  isEditing: boolean;
}

/**
 * useLogicalFilterEditor - Hook for managing logical filter trees (AND/OR expressions)
 * Flattens trees into renderable arrays with operators and parentheses
 * Handles tree transformations: add, delete, toggle operators
 */
export function useLogicalFilterEditor<T>({
  initialValue,
  createNewItem,
  onValueChange,
  isLeafNode,
}: UseLogicalFilterEditorOptions<T>): UseLogicalFilterEditorReturn<T> {
  
  // Helper to ensure binary tree completeness (used for initial values from database)
  const ensureComplete = (node: LogicalFilterTree<T> | null | undefined): LogicalFilterTree<T> => {
    if (!node) return createNewItem();
    
    // Check if it's a valid object (not a string or other primitive)
    if (typeof node !== 'object') return createNewItem();
    
    // Check if it's a valid filter structure with class_name
    if (!('class_name' in node) || typeof node.class_name !== 'string') {
      return createNewItem();
    }
    
    if (isLeafNode(node)) return node;
    
    const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
    
    // Only process if it's actually a logical node
    if (logicalNode.class_name !== 'AndFilter' && logicalNode.class_name !== 'OrFilter') {
      return createNewItem();
    }
    
    return {
      ...logicalNode,
      filter1: ensureComplete(logicalNode.filter1),
      filter2: ensureComplete(logicalNode.filter2),
    };
  };

  // Initialize with empty filter if no value provided
  // If initial value exists, ensure it's complete (fill missing children)
  const [filterTree, setFilterTree] = useState<LogicalFilterTree<T>>(() => {
    if (!initialValue || initialValue === 'missing' || (typeof initialValue === 'string')) {
      return createNewItem();
    }
    return ensureComplete(initialValue);
  });

  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  const flattenedItems = useMemo(() => {
    const items: FlattenedItem<T>[] = [];
    let itemIndex = 0;

    // Helper to check if a node exists (even if empty - we want to render empty placeholders)
    const hasContent = (node: LogicalFilterTree<T> | null | undefined): boolean => {
      if (!node) return false;
      if (isLeafNode(node)) return true; // Any leaf node counts, even empty ones
      
      const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
      return hasContent(logicalNode.filter1) || hasContent(logicalNode.filter2);
    };

    const flatten = (node: LogicalFilterTree<T>, path: number[], depth: number): void => {
      // Check if node exists
      if (!node) return;
      
      // Check if this is a leaf node (actual filter)
      if (isLeafNode(node)) {
        items.push({
          type: 'filter',
          filter: node,
          index: itemIndex++,
          path,
        });
        return;
      }

      // It's a logical node (AND/OR)
      const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
      
      const hasLeftContent = hasContent(logicalNode.filter1);
      const hasRightContent = hasContent(logicalNode.filter2);
      
      // If both children are empty, return
      if (!hasLeftContent && !hasRightContent) {
        return;
      }
      
      // If only one child has content, just flatten that child (skip the operator)
      if (!hasLeftContent && hasRightContent) {
        flatten(logicalNode.filter2, [...path, 2], depth);
        return;
      }
      
      if (hasLeftContent && !hasRightContent) {
        flatten(logicalNode.filter1, [...path, 1], depth);
        return;
      }
      
      // Both children have content - render with operator
      const operator = logicalNode.class_name === 'AndFilter' ? 'AND' : 'OR';

      // Add opening parenthesis for nested expressions (not root)
      if (depth > 0) {
        items.push({ type: 'parenthesis', paren: '(', index: itemIndex++ });
      }

      // Recursively flatten left child
      flatten(logicalNode.filter1, [...path, 1], depth + 1);

      // Add operator
      items.push({
        type: 'operator',
        operator,
        index: itemIndex++,
        path,
      });

      // Recursively flatten right child
      flatten(logicalNode.filter2, [...path, 2], depth + 1);

      // Add closing parenthesis for nested expressions
      if (depth > 0) {
        items.push({ type: 'parenthesis', paren: ')', index: itemIndex++ });
      }
    };

    flatten(filterTree, [], 0);
    return items;
  }, [filterTree, isLeafNode]);

  /**
   * Select an item for editing (only filters, not operators/parentheses)
   */
  const handleItemSelect = useCallback((item: FlattenedItem<T>) => {
    if (item.type === 'filter') {
      console.log('=== Filter selected for editing ===');
      console.log('Filter:', item.filter);
      console.log('Index:', item.index);
      console.log('Path:', item.path);
      setSelectedItemIndex(item.index);
      setEditingItem(item.filter);
    }
  }, []);

  /**
   * Toggle an operator between AND and OR
   */
  const handleOperatorToggle = useCallback((path: number[]) => {
    console.log('=== Toggle operator at path:', path);
    
    const traverse = (node: LogicalFilterTree<T>, currentPath: number[]): LogicalFilterTree<T> => {
      // If we're at the target path, toggle the operator
      if (currentPath.length === 0) {
        if (!isLeafNode(node)) {
          const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
          return {
            ...logicalNode,
            class_name: logicalNode.class_name === 'AndFilter' ? 'OrFilter' : 'AndFilter',
          };
        }
        return node;
      }

      // Continue traversing
      if (!isLeafNode(node)) {
        const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
        const [next, ...rest] = currentPath;
        
        if (next === 1) {
          return {
            ...logicalNode,
            filter1: traverse(logicalNode.filter1, rest),
          };
        } else if (next === 2) {
          return {
            ...logicalNode,
            filter2: traverse(logicalNode.filter2, rest),
          };
        }
      }
      
      return node;
    };

    const updated = traverse(filterTree, path);
    setFilterTree(updated);
    onValueChange?.(updated);
  }, [filterTree, onValueChange, isLeafNode]);

  /**
   * Add a new filter with specified logical operator
   * Creates a new logical node at the root with current tree and new empty filter
   */
  const handleAddFilter = useCallback((logicalOp: 'AND' | 'OR') => {    
    const newFilter = createNewItem();
    
    // Check if we're starting from nothing or from a single empty filter
    const isStartingEmpty = !filterTree || 
      (isLeafNode(filterTree) && (filterTree as any).status === 'empty');
    
    
    let newTree: LogicalFilterTree<T>;
    let newItemIndex: number;
    
    if (isStartingEmpty) {
      // First item - just create a single filter, no logical operator yet
      newTree = newFilter;
      newItemIndex = 0; // The only filter item
    } else {
      // Second or later item - create a logical node
      newTree = {
        class_name: logicalOp === 'AND' ? 'AndFilter' : 'OrFilter',
        filter1: filterTree,
        filter2: newFilter,
      } as LogicalAndFilter<T> | LogicalOrFilter<T>;
      
      // The new filter will be filter2, which appears after the operator
      // Count existing filter items to get the new index
      // After flattening: [existing filters...] [operator] [NEW filter]
      // So count all current filter items
      const countFilters = (node: LogicalFilterTree<T>): number => {
        if (!node) return 0;
        if (isLeafNode(node)) return 1;
        const logical = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
        return countFilters(logical.filter1) + countFilters(logical.filter2);
      };
      newItemIndex = countFilters(filterTree); // New filter comes after all existing ones
    }

    setFilterTree(newTree);
    onValueChange?.(newTree);
    
    // Auto-select the newly added item so the composer panel opens
    setSelectedItemIndex(newItemIndex);
    setEditingItem(newFilter);
  }, [filterTree, createNewItem, onValueChange, isLeafNode]);

  /**
   * Update the currently selected filter with new values
   */
  const handleItemChange = useCallback((newItem: T) => {
    console.log('=== Update filter ===');
    console.log('New item:', newItem);
    
    if (!editingItem) return;

    // Find the path to the editing item
    const findPath = (node: LogicalFilterTree<T>, target: T, currentPath: number[]): number[] | null => {
      if (!node) return null;
      
      if (isLeafNode(node) && node === editingItem) {
        return currentPath;
      }
      
      if (!isLeafNode(node)) {
        const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
        
        if (logicalNode.filter1) {
          const leftPath = findPath(logicalNode.filter1, target, [...currentPath, 1]);
          if (leftPath) return leftPath;
        }
        
        if (logicalNode.filter2) {
          const rightPath = findPath(logicalNode.filter2, target, [...currentPath, 2]);
          if (rightPath) return rightPath;
        }
      }
      
      return null;
    };

    const path = findPath(filterTree, editingItem, []);
    if (!path) {
      console.warn('Could not find path to editing item');
      return;
    }

    const traverse = (node: LogicalFilterTree<T>, currentPath: number[]): LogicalFilterTree<T> => {
      if (currentPath.length === 0) {
        return newItem;
      }

      if (!node) return node;

      if (!isLeafNode(node)) {
        const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
        const [next, ...rest] = currentPath;
        
        if (next === 1 && logicalNode.filter1) {
          return {
            ...logicalNode,
            filter1: traverse(logicalNode.filter1, rest),
          };
        } else if (next === 2 && logicalNode.filter2) {
          return {
            ...logicalNode,
            filter2: traverse(logicalNode.filter2, rest),
          };
        }
      }
      
      return node;
    };

    const updated = traverse(filterTree, path);
    setFilterTree(updated);
    onValueChange?.(updated);
    setEditingItem(newItem);
  }, [filterTree, editingItem, onValueChange, isLeafNode]);

  /**
   * Delete a filter at the specified path
   * If deleting from a logical node, promote the sibling
   */
  const handleDeleteItem = useCallback((path: number[]) => {
    console.log('=== Delete filter at path:', path);
    
    // If path is empty, we're deleting the root - replace with new empty filter
    if (path.length === 0) {
      const newFilter = createNewItem();
      setFilterTree(newFilter);
      onValueChange?.(newFilter);
      setSelectedItemIndex(null);
      setEditingItem(null);
      return;
    }

    const traverse = (node: LogicalFilterTree<T>, currentPath: number[]): LogicalFilterTree<T> | null => {
      // If we have one step left, this node's child is the target
      if (currentPath.length === 1) {
        if (!isLeafNode(node)) {
          const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
          const target = currentPath[0];
          
          // Return the sibling (promote it)
          if (target === 1) {
            return logicalNode.filter2;
          } else if (target === 2) {
            return logicalNode.filter1;
          }
        }
        return node;
      }

      // Continue traversing
      if (!isLeafNode(node)) {
        const logicalNode = node as LogicalAndFilter<T> | LogicalOrFilter<T>;
        const [next, ...rest] = currentPath;
        
        if (next === 1) {
          const updated1 = traverse(logicalNode.filter1, rest);
          if (updated1 === null) return logicalNode.filter2;
          return { ...logicalNode, filter1: updated1 };
        } else if (next === 2) {
          const updated2 = traverse(logicalNode.filter2, rest);
          if (updated2 === null) return logicalNode.filter1;
          return { ...logicalNode, filter2: updated2 };
        }
      }
      
      return node;
    };

    const updated = traverse(filterTree, path);
    if (updated) {
      setFilterTree(updated);
      onValueChange?.(updated);
    }
    
    // Clear selection if we deleted the selected item
    setSelectedItemIndex(null);
    setEditingItem(null);
  }, [filterTree, createNewItem, onValueChange, isLeafNode]);

  const handleEditingDone = useCallback(() => {
    console.log('=== Editing done ===');
    setSelectedItemIndex(null);
    setEditingItem(null);
  }, []);

  return {
    selectedItemIndex,
    editingItem,
    filterTree,
    flattenedItems,
    handleItemSelect,
    handleOperatorToggle,
    handleAddFilter,
    handleItemChange,
    handleDeleteItem,
    handleEditingDone,
    isEditing: selectedItemIndex !== null && editingItem !== null,
  };
}
