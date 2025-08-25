import React from 'react';
import { ListItem, ListItemProps } from './ListItem';
import styles from './ItemList.module.css';

export interface ItemListProps {
  items: ListItemProps[];
  selectedName?: string;
  onSelect?: (name: string) => void;
  classNameListItem?: string;
  classNameListItemSelected?: string;
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  selectedName,
  onSelect,
  classNameListItem,
  classNameListItemSelected,
}) => {
  return (
    <div className={styles.container}>
      {items.map(item => (
        <ListItem
          key={item.name}
          {...item}
          selected={selectedName === item.name}
          onClick={() => onSelect?.(item.name)}
          classNameListItem={classNameListItem}
          classNameListItemSelected={classNameListItemSelected}
        />
      ))}
    </div>
  );
};
