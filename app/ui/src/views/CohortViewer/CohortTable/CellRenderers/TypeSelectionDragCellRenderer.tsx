import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './TypeSelectionDragCellRenderer.module.css';
import { getHierarchicalBackgroundColor } from './PhenexCellRenderer';
import { TypeRenderer } from './actualRendering/TypeRenderer';

interface TypeSelectionDragCellRendererProps extends ICellRendererParams {
  colorBackground?: boolean;
  colorBorder?: boolean;
}

export const TypeSelectionDragCellRenderer: React.FC<TypeSelectionDragCellRendererProps> = (props) => {
  const { colorBackground = true, colorBorder = true } = props;

  const shouldColorBackground = props.data?.colorCellBackground !== undefined
    ? props.data.colorCellBackground
    : colorBackground;

  const shouldColorBorder = props.data?.colorCellBorder !== undefined
    ? props.data.colorCellBorder
    : colorBorder;

  const backgroundColor = shouldColorBackground
    ? getHierarchicalBackgroundColor(props.data?.effective_type, props.data?.hierarchical_index)
    : 'transparent';

  const borderColorVar = shouldColorBorder && props.data?.effective_type
    ? `var(--color_${props.data.effective_type}_dim)`
    : 'transparent';

  const isSelected = props.node?.isSelected();

  const handleClick = () => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
    });
  };

  return (
    <div
      className={styles.container}
      style={{
        borderTopColor: borderColorVar,
        borderLeft: `1px solid ${borderColorVar}`,
        ...(backgroundColor ? { backgroundColor } : {}),
      }}
    >
      {isSelected && <div className={styles.selectionIndicator} />}
      <div className={styles.dragHandle} data-drag-handle="true">⠿</div>
      <div className={styles.typeContent}>
        <TypeRenderer value={props.value} data={props.data} onClick={handleClick} />
      </div>
    </div>
  );
};

export default TypeSelectionDragCellRenderer;
