import React from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { SingleRelativeTimeRangeFilterEditor } from './relativeTimeRangeFilterEditor/SingleRelativeTimeRangeFilterEditor';
import { useComplexItemEditor } from '../../../../hooks/useComplexItemEditor';
import { TimeRangeFilter } from './relativeTimeRangeFilterEditor/types';

interface RelativeTimeRangeFilterCellEditorProps extends PhenexCellEditorProps {
  value: TimeRangeFilter[];
  onValueChange?: (value: any) => void;
}

export const RelativeTimeRangeFilterCellEditor = React.forwardRef<any, RelativeTimeRangeFilterCellEditorProps>((props, ref) => {
  console.log('RelativeTimeRangeFilterCellEditor opened with:', {
    propsValue: props.value,
    valueType: typeof props.value,
    valueIsArray: Array.isArray(props.value),
    valueLength: Array.isArray(props.value) ? props.value.length : 'N/A',
    propsData: props.data,
    _clickedItemIndex: props.data?._clickedItemIndex,
  });
  
  // Read clicked index from node.data (set by renderer)
  const clickedItemIndex = props.data?._clickedItemIndex;
  console.log('Clicked item index from props.data:', clickedItemIndex);
  
  // Clean up after reading
  if (clickedItemIndex !== undefined && props.data) {
    console.log('Cleaning up _clickedItemIndex from node.data');
    delete props.data._clickedItemIndex;
  }
  
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
    initialValue: props.value,
    clickedItemIndex: clickedItemIndex,
    createNewItem: (): TimeRangeFilter => ({
      class_name: 'RelativeTimeRangeFilter' as const,
      min_days: { class_name: 'Value' as const, operator: '>' as const, value: 0 },
      max_days: { class_name: 'Value' as const, operator: '<' as const, value: 365 },
      when: 'before' as const,
      useConstant: false,
      useIndexDate: true,
      anchor_phenotype: null,
    }),
  });
  
  console.log('useComplexItemEditor returned:', {
    selectedItemIndex,
    editingItem,
    editingItemDetails: editingItem ? {
      min_days: editingItem.min_days,
      max_days: editingItem.max_days,
      when: editingItem.when,
    } : null,
    items,
    itemsLength: items.length,
    firstItemDetails: items[0] ? {
      min_days: items[0].min_days,
      max_days: items[0].max_days,
      when: items[0].when,
    } : null,
  });

  // Sync items to PhenexCellEditor whenever they change
  React.useEffect(() => {
    props.onValueChange?.(items);
  }, [items, props.onValueChange]);

  return (
    <PhenexCellEditor 
      {...props}
      ref={ref}
      value={items}
      fieldName="relative_time_range_filter"
      showComposerPanel={isEditing}
      showAddButton={true}
      onAddItem={handleAddItem}
      onItemSelect={handleItemSelect}
      onEditingDone={handleEditingDone}
      selectedItemIndex={selectedItemIndex ?? undefined}
    >
      {isEditing && editingItem ? (
        <SingleRelativeTimeRangeFilterEditor
          key={selectedItemIndex}
          value={editingItem}
          onValueChange={handleItemChange}
        />
      ) : null}
    </PhenexCellEditor>
  );
});

RelativeTimeRangeFilterCellEditor.displayName = 'RelativeTimeRangeFilterCellEditor';
