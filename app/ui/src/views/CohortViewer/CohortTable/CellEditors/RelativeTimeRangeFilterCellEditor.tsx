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
