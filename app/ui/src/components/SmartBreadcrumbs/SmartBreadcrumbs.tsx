import { FC, useRef, useState } from 'react';
import styles from './SmartBreadcrumbs.module.css';
import { PopupEditableTextField } from '../PopupEditableTextField';

interface BreadcrumbItem {
  displayName: string;
  onClick: () => void;
}

interface SmartBreadcrumbsProps {
  items: BreadcrumbItem[];
  onEditLastItem?: (newValue: string) => void;
  classNameSmartBreadcrumbsContainer?: string;
  classNameBreadcrumbItem?: string;
}

export const SmartBreadcrumbs: FC<SmartBreadcrumbsProps> = ({ items, onEditLastItem, classNameSmartBreadcrumbsContainer, classNameBreadcrumbItem }) => {
  const lastItemRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorPosition, setEditorPosition] = useState({ x: 0, y: 0 });
  const [editingValue, setEditingValue] = useState('');

  const handleLastItemClick = () => {
    if (onEditLastItem && lastItemRef.current) {
      const rect = lastItemRef.current.getBoundingClientRect();
      const x = rect.left;
      const y = rect.bottom + 5; // Position slightly below the element
      
      setEditingValue(items[items.length - 1].displayName);
      setEditorPosition({ x, y });
      setShowEditor(true);
    } else if (items.length > 0) {
      items[items.length - 1].onClick();
    }
  };

  const handleSave = (newValue: string) => {
    if (onEditLastItem) {
      onEditLastItem(newValue);
    }
    setShowEditor(false);
  };

  const handleClose = () => {
    setShowEditor(false);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`${styles.container} ${classNameSmartBreadcrumbsContainer}`}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <div key={index} className={styles.itemWrapper}>
              <div
                ref={isLast ? lastItemRef : null}
                className={`${styles.item} ${isLast ? styles.lastItem : styles.regularItem} ${classNameBreadcrumbItem}`}
                onClick={isLast ? handleLastItemClick : item.onClick}
              >
                {item.displayName}
              </div>
              {!isLast && <div className={styles.separator}>/</div>}
            </div>
          );
        })}
      </div>
      
      {showEditor && (
        <PopupEditableTextField
          value={editingValue}
          x={editorPosition.x}
          y={editorPosition.y}
          onChange={setEditingValue}
          onSave={handleSave}
          onClose={handleClose}
          placeholder="Enter name..."
        />
      )}
    </>
  );
};
