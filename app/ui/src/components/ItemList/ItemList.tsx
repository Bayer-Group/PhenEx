import React from 'react';
import { ListItem, ListItemProps } from './ListItem';
import styles from './ItemList.module.css';

export interface ItemListProps {
  items: ListItemProps[];
  selectedName?: string;
  onSelect?: (name: string) => void;
}

export const ItemList: React.FC<ItemListProps> = ({ items, selectedName, onSelect }) => {
  return (
    <div className={styles.container}>
      {items.map(item => (
        <ListItem
          key={item.name}
          {...item}
          selected={selectedName === item.name}
          onClick={() => onSelect?.(item.name)}
        />
      ))}
    </div>
  );
};
