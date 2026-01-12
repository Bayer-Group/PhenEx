import React from 'react';
import styles from './ItemList.module.css';

export interface ListItemProps {
  name: string;
  info: string;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  classNameListItem?: string;
  classNameListItemSelected?: string;
}

export const ListItem: React.FC<ListItemProps> = ({
  name,
  info,
  selected,
  highlighted,
  onClick,
  classNameListItem,
  classNameListItemSelected,
}) => {
  return (
    <div
      className={`${styles.listItem} ${selected ? styles.selected : ''} ${highlighted ? styles.highlighted : ''} ${classNameListItem} ${selected ? classNameListItemSelected : ''}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
    >
      {/* {selected && (
        <div className={styles.checkmarkCircle}>
          ✓
        </div>
      )} */}
      <div className={styles.itemName}>{name}</div>
      {/* <p className={styles.itemInfo}>{info}</p> */}
    </div>
  );
};
