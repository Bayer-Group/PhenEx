import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { SettingsEditor, SettingsEditorProps } from './settingsEditor/SettingsEditor';
interface SettingsCellEditorProps extends PhenexCellEditorProps {
  value?: any;
}

export const SettingsCellEditor = forwardRef<any, SettingsCellEditorProps>((props, ref) => {
  const handleValueChange = (value: any) => {
    props.onValueChange?.(value);
  };

  return (
    <PhenexCellEditor {...props} ref={ref}>
      <SettingsEditor {...props} onValueChange={handleValueChange} />
    </PhenexCellEditor>
  );
});

SettingsCellEditor.displayName = 'SettingsCellEditor';
