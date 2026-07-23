import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import styles from './CohortCardViewer.module.css';
import {
  ShimApi,
  ShimBacking,
  makeEditorParams,
  makeRendererParams,
  resolveEditor,
} from './gridApiShim';
import { columnNameToApplicablePhenotypeMapping } from '../../../assets/phenotype_applicable_parameters';

/**
 * Simple inline text editor emulating AG Grid's built-in 'agTextCellEditor'.
 * Exposes getValue() so the editing lifecycle can read the committed value.
 */
const AgTextCellEditor = forwardRef<any, any>((props, ref) => {
  const [value, setValue] = useState<string>(props.value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => valueRef.current,
    isPopup: () => false,
  }));

  return (
    <input
      ref={inputRef}
      className={styles.inlineTextEditor}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          props.api.stopEditing();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          props.api.stopEditing(true);
        }
      }}
      onBlur={() => props.api.stopEditing()}
    />
  );
});
AgTextCellEditor.displayName = 'AgTextCellEditor';

interface CohortCardCellProps {
  rowData: any;
  rowIndex: number;
  colDef: any;
  api: ShimApi;
  backing: ShimBacking;
  isEditing: boolean;
  eventKey?: string;
  /** Called with the editor's imperative ref + a value-parser so the parent can commit on stopEditing. */
  registerEditor: (editorRef: React.RefObject<any>, onValueChange: (v: any) => void) => void;
}

export const CohortCardCell: React.FC<CohortCardCellProps> = ({
  rowData,
  rowIndex,
  colDef,
  api,
  backing,
  isEditing,
  eventKey,
  registerEditor,
}) => {
  const cellRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const latestValueRef = useRef<any>(rowData?.[colDef.field]);

  // Register the editor ref with the parent whenever this cell enters edit mode.
  useEffect(() => {
    if (isEditing) {
      registerEditor(editorRef, (v: any) => {
        latestValueRef.current = v;
      });
    }
  }, [isEditing, registerEditor]);

  const width = colDef.flex ? undefined : colDef.width ?? 150;

  const field = colDef.field as string | undefined;
  const isNA =
    field &&
    Object.keys(columnNameToApplicablePhenotypeMapping).includes(field) &&
    !(columnNameToApplicablePhenotypeMapping as any)[field]?.includes(rowData?.class_name);

  const cellStyle: React.CSSProperties = {
    width: width !== undefined ? `${width}px` : undefined,
    flex: colDef.flex ? `${colDef.flex} 1 0` : '0 0 auto',
    ...({ backgroundColor: 'var(--background_color_light)' }),
    ...(colDef.cellStyle && typeof colDef.cellStyle !== 'function' ? colDef.cellStyle : {}),
    ...(isEditing ? { position: 'relative' } : {}),
  };

  const renderBackgroundContent = () => {
    const Renderer = colDef.cellRenderer;
    if (!Renderer) {
      const value = rowData?.[colDef.field];
      return <span className={styles.plainValue}>{value ?? ''}</span>;
    }
    const rendererParams = makeRendererParams({
      rowData,
      rowIndex,
      colDef,
      api,
      backing,
      eGridCell: cellRef.current,
    });
    const RendererComponent = Renderer as React.ComponentType<any>;
    return <RendererComponent {...rendererParams} />;
  };

  const renderContent = () => {
    if (isEditing) {
      const editorParams = makeEditorParams({
        rowData,
        rowIndex,
        colDef,
        api,
        backing,
        eGridCell: cellRef.current,
        eventKey,
        onValueChange: (v: any) => {
          latestValueRef.current = v;
        },
      });
      const { component } = resolveEditor(colDef, editorParams);

      const editorElement =
        !component || component === 'agTextCellEditor' ? (
          <AgTextCellEditor ref={editorRef} {...editorParams} />
        ) : (
          (() => {
            const EditorComponent = component as React.ComponentType<any>;
            return <EditorComponent ref={editorRef} {...editorParams} />;
          })()
        );

      return (
        <>
          {renderBackgroundContent()}
          <div style={{ position: 'absolute', inset: 0 }}>{editorElement}</div>
        </>
      );
    }

    return renderBackgroundContent();
  };

  return (
    <div
      ref={cellRef}
      className={styles.cell}
      style={cellStyle}
      data-field={colDef.field}
      onDoubleClick={e => {
        if (isEditing) return;
        e.stopPropagation();
        api.startEditingCell({ rowIndex, colKey: colDef.field });
      }}
    >
      {renderContent()}
    </div>
  );
};
