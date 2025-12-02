import { forwardRef, useImperativeHandle } from 'react';
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

    // Expose AG Grid cell editor interface
    useImperativeHandle(ref, () => ({
      getValue: () => filterTree,
      afterGuiAttached: () => {
        console.log('CategoricalFilterCellEditor attached');
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
