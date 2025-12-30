import { forwardRef, useImperativeHandle, useEffect } from 'react';
import { FilterType, SingleLogicalExpression } from './logicalExpressionEditor/types';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { SimplifiedSingleLogicalExpressionEditor } from './logicalExpressionEditor/SimplifiedSingleLogicalExpressionEditor';
import { useLogicalFilterEditor } from '../../../../hooks/useLogicalFilterEditor';

/**
 * LogicalExpressionCellEditor - AG Grid cell editor for logical expression trees
 * 
 * Uses useLogicalFilterEditor hook to manage the expression tree with logical operators.
 * Integrates with PhenexCellEditor to show SimplifiedSingleLogicalExpressionEditor
 * when an expression is selected for editing.
 */
export const LogicalExpressionCellEditor = forwardRef<any, PhenexCellEditorProps>(
  (props, ref) => {
    const initialValue = props.value as FilterType | undefined;
    
    // Read clicked index from node.data (set by renderer)
    const clickedItemIndex = props.data?._clickedItemIndex;
    
    // Clean up after reading
    if (clickedItemIndex !== undefined && props.data) {
      delete props.data._clickedItemIndex;
    }

    // Type guard to identify leaf nodes (SingleLogicalExpression)
    const isLeafNode = (value: any): value is SingleLogicalExpression => {
      return value && typeof value === 'object' && value.class_name === 'LogicalExpression';
    };

    // Create a new empty logical expression
    const createNewItem = (): SingleLogicalExpression => ({
      class_name: 'LogicalExpression',
      phenotype_name: '',
      phenotype_id: '',
      id: Math.random().toString(36),
      status: 'empty',
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
    } = useLogicalFilterEditor<SingleLogicalExpression>({
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
        clickedItemIndex={clickedItemIndex}
        rendererProps={{
          onOperatorClick: handleOperatorToggle,
        }}
      >
        {isEditing && editingItem ? (
          <SimplifiedSingleLogicalExpressionEditor
            value={editingItem}
            onValueChange={handleItemChange}
            phenotype={props.data}
          />
        ) : null}
      </PhenexCellEditor>
    );
  }
);

LogicalExpressionCellEditor.displayName = 'LogicalExpressionCellEditor';
