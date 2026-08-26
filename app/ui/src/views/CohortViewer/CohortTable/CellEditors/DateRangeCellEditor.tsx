import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { DateRangeEditor } from './dateRangeEditor/DateRangeEditor';
import { useComplexItemEditor } from '../../../../hooks/useComplexItemEditor';
import { DateRange } from './dateRangeEditor/types';

interface DateRangeCellEditorProps extends PhenexCellEditorProps {
  value: DateRange | null;
  onValueChange?: (value: any) => void;
}

const createDefaultDateRange = (): DateRange => ({
  class_name: 'ValueFilter',
  min_value: null,
  max_value: null,
  column_name: 'EVENT_DATE',
});

export const DateRangeCellEditor = forwardRef((props: DateRangeCellEditorProps, ref) => {
  const clickedItemIndex = props.data?._clickedItemIndex;
  if (clickedItemIndex !== undefined && props.data) {
    delete props.data._clickedItemIndex;
  }

  // Normalise: always a single-item array (or empty when not set)
  const normalizeValue = (value: any): DateRange[] => {
    if (!value) return [];
    if (typeof value === 'object' && value.class_name === 'ValueFilter') return [value];
    return [];
  };

  // Output is a single DateRange (or null when cleared)
  const formatOutput = (items: DateRange[]): DateRange | null => items[0] ?? null;

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
    clickedItemIndex,
    createNewItem: createDefaultDateRange,
  });

  React.useEffect(() => {
    props.onValueChange?.(formatOutput(items));
  }, [items, props.onValueChange]);

  return (
    <PhenexCellEditor
      {...props}
      ref={ref}
      value={formatOutput(items)}
      fieldName="date_range"
      showComposerPanel={isEditing}
      showAddButton={items.length < 1}
      onAddItem={handleAddItem}
      onItemSelect={handleItemSelect}
      onEditingDone={handleEditingDone}
      selectedItemIndex={selectedItemIndex ?? undefined}
    >
      {isEditing && editingItem ? (
        <DateRangeEditor
          key={selectedItemIndex}
          value={editingItem}
          onValueChange={handleItemChange}
        />
      ) : null}
    </PhenexCellEditor>
  );
});

DateRangeCellEditor.displayName = 'DateRangeCellEditor';
