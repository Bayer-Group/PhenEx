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

  // A value filter is always a single ValueFilter. Coerce any legacy shape
  // (AndFilter or array) down to a single filter for editing.
  const normalizeValue = (value: any): ValueFilter[] => {
    if (!value) return [];
    if (value.class_name === 'AndFilter') return [value.filter1];
    if (Array.isArray(value)) return value.slice(0, 1);
    return [value];
  };

  // Output is always a single ValueFilter (or null when cleared).
  const formatOutput = (filters: ValueFilter[]): ValueFilter | null => {
    return filters[0] ?? null;
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
