import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import editPencilIcon from '../../../../assets/icons/edit-pencil.svg';
import styles from './NameCellRenderer.module.css';

interface NameCellRendererProps extends ICellRendererParams {
  value: string;
}

const NameCellRenderer: React.FC<NameCellRendererProps> = props => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
    padding: '0',
    position: 'relative',
  };

  return (
    <div style={containerStyle}>
      <span>{props.value}</span>
      <button
        className={styles.editButton}
        onClick={() =>
          props.api.startEditingCell({
            rowIndex: props.rowIndex,
            colKey: props.column.getColId(),
          })
        }
      >
        <img src={editPencilIcon} className={styles.editIcon} alt="Edit" />
      </button>
    </div>
  );
};

export default NameCellRenderer;
