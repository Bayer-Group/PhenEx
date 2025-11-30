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
    // Old: {file_name: '...', code_column: '...', ...}
    // New: {class_name: 'Codelist', codelist: {file_name: '...', ...}, ...}
    if (codelist && typeof codelist === 'object') {
      return {
        class_name: 'Codelist',
        codelist: codelist, // Wrap the flat data
        codelist_type: 'from file', // Assume file type for old data
        use_code_type: true,
        remove_punctuation: false,
      };
    }
    
    return codelist;
  };

  // Normalize the initial value before passing to hook
  const normalizedValue = React.useMemo(() => {
    console.log('Normalizing props.value:', props.value);
    let result;
    if (Array.isArray(props.value)) {
      result = props.value.map(normalizeCodelist);
    } else {
      result = normalizeCodelist(props.value);
    }
    console.log('Normalized result:', result);
    return result;
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
    // Call props.onValueChange to keep PhenexCellEditor's currentValue in sync
    onValueChange: (items) => {
      console.log("VALUE CHANGED CODELIST CELL EDITOR", items)
      // Update PhenexCellEditor's internal value (for getValue())
      // But don't call AG Grid's onValueChange - that happens when editor closes
    },
  });

  CodelistCellEditor.displayName = 'CodelistCellEditor';

  console.log('CodelistCellEditor render - isEditing:', isEditing, 'editingItem:', editingItem, 'selectedItemIndex:', selectedItemIndex, 'props.value:', props.value);

  return (
    <PhenexCellEditor 
      {...props}
      // Pass the current items array as value for rendering in mirror
      value={items}
      // Override onValueChange - let PhenexCellEditor's handleValueChange update currentValue
      // but don't propagate to AG Grid until editor closes
      onValueChange={(value) => {
        console.log("CodelistCellEditor: Intercepted onValueChange with:", value);
        // Don't call props.onValueChange - we return value via getValue() when editor closes
      }}
      ref={ref}
      fieldName="codelist"
      showComposerPanel={isEditing}
      showAddButton={true}
      onAddItem={handleAddItem}
      onItemSelect={handleItemSelect}
      onEditingDone={handleEditingDone}
    >
      {isEditing && editingItem ? (
        <div>
          <SingleCodelistEditor
            key={selectedItemIndex}
            value={editingItem}
            options={props.options}
            onValueChange={handleItemChange}
            onEditingDone={handleEditingDone}
          />
        </div>
      ) : null}
      {/* <div className={styles.chin}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={useCodeType}
              onChange={e => setUseCodeType(e.target.checked)}
            />
            use_code_type
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={removePunctuation}
              onChange={e => setRemovePunctuation(e.target.checked)}
            />
            remove_punctuation
          </label>
        </div> */}
    </PhenexCellEditor>
  );
});

CodelistCellEditor.displayName = 'CodelistCellEditor';
