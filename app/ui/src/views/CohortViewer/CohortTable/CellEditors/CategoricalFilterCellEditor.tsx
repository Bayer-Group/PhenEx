import { forwardRef, useImperativeHandle, useEffect } from 'react';
import { FilterType, BaseCategoricalFilter } from './categoricalFilterEditor/types';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { SimplifiedSingleCategoricalFilterEditor } from './categoricalFilterEditor/SimplifiedSingleCategoricalFilterEditor';
import { useLogicalFilterEditor } from '../../../../hooks/useLogicalFilterEditor';

/**
 * CategoricalFilterCellEditor - AG Grid cell editor for categorical filter trees
 * 
 * Uses useLogicalFilterEditor hook to manage the filter tree with logical operators.
 * Integrates with PhenexCellEditor to show SimplifiedSingleCategoricalFilterEditor
 * when a filter item is selected for editing.
 */
export const CategoricalFilterCellEditor = forwardRef<any, PhenexCellEditorProps>(
  (props, ref) => {
    const initialValue = props.value as FilterType | undefined;
    const clickedItemIndex = (props as any).clickedItemIndex;

    // Type guard to identify leaf nodes (BaseCategoricalFilter)
    const isLeafNode = (value: any): value is BaseCategoricalFilter => {
      return value && typeof value === 'object' && value.class_name === 'CategoricalFilter';
    };

    // Create a new empty categorical filter
    const createNewItem = (): BaseCategoricalFilter => ({
      class_name: 'CategoricalFilter',
      column_name: '',
      allowed_values: [],
      domain: '',
      status: 'empty',
      id: Math.random().toString(36),
    });

    // Use the logical filter editor hook
    const {
      selectedItemIndex,
      editingItem,
      filterTree,
      flattenedItems,
      handleItemSelect,
      handleOperatorToggle,
      handleAddFilter,
      handleItemChange,
      handleEditingDone,
      isEditing,
    } = useLogicalFilterEditor<BaseCategoricalFilter>({
      initialValue,
      createNewItem,
      onValueChange: props.onValueChange,
      isLeafNode,
    });

    // Auto-select the clicked filter item when editor opens
    useEffect(() => {
      if (!isEditing && flattenedItems.length > 0) {
        let itemToSelect = null;
        
        if (clickedItemIndex !== undefined) {
          itemToSelect = flattenedItems.find(
            item => item.type === 'filter' && item.index === clickedItemIndex
          );
        }
        
        if (!itemToSelect) {
          itemToSelect = flattenedItems.find(item => item.type === 'filter');
        }
        
        if (itemToSelect) {
          handleItemSelect(itemToSelect);
        }
      }
    }, []);

    useImperativeHandle(ref, () => ({
      getValue: () => filterTree,
    }));

    // Extract AG Grid-specific props and exclude our custom props to avoid conflicts
    const { onValueChange, showComposerPanel: _showComposerPanel, ...agGridProps } = props;

    return (
      <PhenexCellEditor
        {...agGridProps}
        ref={ref}
        value={filterTree}
        onValueChange={onValueChange}
        selectedItemIndex={selectedItemIndex ?? undefined}
        onEditingDone={handleEditingDone}
        onAddItem={() => handleAddFilter('AND')}
        onItemSelect={handleItemSelect}
        showAddButton={true}
        showComposerPanel={isEditing}
        rendererProps={{
          onOperatorClick: handleOperatorToggle,
        }}
      >
        {isEditing && editingItem ? (
          <SimplifiedSingleCategoricalFilterEditor
            value={editingItem as any}
            onValueChange={handleItemChange}
          />
        ) : null}
      </PhenexCellEditor>
    );
  }
);

CategoricalFilterCellEditor.displayName = 'CategoricalFilterCellEditor';
