import React from 'react';
import styles from './ItemList.module.css';

export interface ListItemProps {
  name: string;
  info: string;
  selected?: boolean;
  onClick?: () => void;
}

export const ListItem: React.FC<ListItemProps> = ({ name, info, selected, onClick }) => {
  return (
    <div
      className={`${styles.listItem} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
    >
      <div className={styles.itemName}>{name}</div>
      <p className={styles.itemInfo}>{info}</p>
    </div>
  );
};
