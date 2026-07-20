import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { SingleValueFilterEditor } from './valueFilterEditor/SingleValueFilterEditor';
import { useComplexItemEditor } from '../../../../hooks/useComplexItemEditor';
import { ValueFilter, AndFilter } from './valueFilterEditor/types';

interface ValueFilterCellEditorProps extends PhenexCellEditorProps {
  value?: ValueFilter | ValueFilter[] | AndFilter;
  onValueChange?: (value: any) => void;
}

export const ValueFilterCellEditor = forwardRef((props: ValueFilterCellEditorProps, ref) => {
  // Read clicked index from node.data (set by renderer)
  const clickedItemIndex = props.data?._clickedItemIndex;
  
  // Clean up after reading
  if (clickedItemIndex !== undefined && props.data) {
    delete props.data._clickedItemIndex;
  }

  const filterPhenotypes = ['MeasurementPhenotype', 'AgePhenotype'];
  if (!filterPhenotypes.includes(props.data.class_name)) {
    return <div></div>;
  }

  // Normalize value to array
  const normalizeValue = (value: any): ValueFilter[] => {
    if (!value) return [];
    if (value.class_name === 'AndFilter') {
      return [value.filter1, value.filter2];
    }
    if (Array.isArray(value)) return value;
    return [value];
  };

  // Convert array back to the format the backend expects: ValueFilter | AndFilter | null
  const formatOutput = (filters: ValueFilter[]): ValueFilter | AndFilter | null => {
    if (filters.length === 0) return null;
    if (filters.length === 1) return filters[0];
    return { class_name: 'AndFilter', filter1: filters[0], filter2: filters[1] };
  };

  // Use the shared complex item editor hook
  const {
    selectedItemIndex,
    editingItem,
    handleItemSelect,
    handleAddItem,
    handleItemChange,
    handleEditingDone,
    isEditing,
    items,
  } = useComplexItemEditor({
    initialValue: normalizeValue(props.value),
    clickedItemIndex: clickedItemIndex,
    createNewItem: (): ValueFilter => ({
      class_name: 'ValueFilter',
      min_value: { class_name: 'Value', operator: '>=', value: null },
      max_value: { class_name: 'Value', operator: '<', value: null },
      column_name: '',
    }),
  });

  // Sync formatted value to parent (AG Grid getValue)
  React.useEffect(() => {
    props.onValueChange?.(formatOutput(items));
  }, [items, props.onValueChange]);

  return (
    <PhenexCellEditor 
      {...props}
      ref={ref}
      value={formatOutput(items)}
      fieldName="value_filter"
      showComposerPanel={isEditing}
      showAddButton={items.length < 1}
      onAddItem={handleAddItem}
      onItemSelect={handleItemSelect}
      onEditingDone={handleEditingDone}
      selectedItemIndex={selectedItemIndex ?? undefined}
    >
      {isEditing && editingItem ? (
        <SingleValueFilterEditor
          key={selectedItemIndex}
          value={editingItem}
          onValueChange={handleItemChange}
          data={props.data}
        />
      ) : null}
    </PhenexCellEditor>
  );
});

ValueFilterCellEditor.displayName = 'ValueFilterCellEditor';
