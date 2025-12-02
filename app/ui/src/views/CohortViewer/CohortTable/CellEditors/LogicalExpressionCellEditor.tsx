import { forwardRef, useImperativeHandle } from 'react';
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

    // Expose AG Grid cell editor interface
    useImperativeHandle(ref, () => ({
      getValue: () => filterTree,
      afterGuiAttached: () => {
        console.log('LogicalExpressionCellEditor attached');
      },
    }));

    return (
      <PhenexCellEditor
        {...props}
        ref={ref}
        value={filterTree}
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
