import React from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { SingleCodelistEditor } from './codelistCellEditor/SingleCodelistEditor';
import { useComplexItemEditor } from '../../../../hooks/useComplexItemEditor';

interface CodelistCellEditorProps extends PhenexCellEditorProps {
  options?: string[];
}

export const CodelistCellEditor = React.forwardRef<any, CodelistCellEditorProps>((props, ref) => {
  // Normalize old flat format codelists to new wrapped format
  const normalizeCodelist = (codelist: any): any => {
    // If already in new format with class_name, return as is
    if (codelist?.class_name === 'Codelist') {
      return codelist;
    }
    
    // Convert old flat format to new wrapped format
    if (codelist && typeof codelist === 'object') {
      return {
        class_name: 'Codelist',
        codelist: codelist,
        codelist_type: 'from file',
        use_code_type: true,
        remove_punctuation: false,
      };
    }
    
    return codelist;
  };

  // Normalize the initial value
  const normalizedValue = React.useMemo(() => {
    if (Array.isArray(props.value)) {
      return props.value.map(normalizeCodelist);
    }
    return normalizeCodelist(props.value);
  }, [props.value]);

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
    initialValue: normalizedValue,
    createNewItem: () => ({
      class_name: 'Codelist',
      codelist: {},
      use_code_type: true,
      remove_punctuation: false,
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
      fieldName="codelist"
      showComposerPanel={isEditing}
      showAddButton={true}
      onAddItem={handleAddItem}
      onItemSelect={handleItemSelect}
      onEditingDone={handleEditingDone}
    >
      {isEditing && editingItem ? (
        <SingleCodelistEditor
          key={selectedItemIndex}
          value={editingItem}
          options={props.options}
          onValueChange={handleItemChange}
        />
      ) : null}
    </PhenexCellEditor>
  );
});

CodelistCellEditor.displayName = 'CodelistCellEditor';
