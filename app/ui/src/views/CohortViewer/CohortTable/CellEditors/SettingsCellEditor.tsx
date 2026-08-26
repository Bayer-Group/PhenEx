import React, { forwardRef } from 'react';
import { PhenexCellEditor, PhenexCellEditorProps } from './PhenexCellEditor';
import { SettingsEditor, SettingsEditorProps } from './settingsEditor/SettingsEditor';
interface SettingsCellEditorProps extends PhenexCellEditorProps {
  // value is inherited from PhenexCellEditorProps
}

export const SettingsCellEditor = forwardRef<any, SettingsCellEditorProps>((props, ref) => {
  return (
    <PhenexCellEditor {...props} ref={ref} autoCloseOnChange={true}>
      <SettingsEditor {...props} />
    </PhenexCellEditor>
  );
});

SettingsCellEditor.displayName = 'SettingsCellEditor';
