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

  const allButLast = items.slice(0, -1);
  const lastItem = items[items.length - 1];

  return (
    <>
      <div className={`${styles.container} ${classNameSmartBreadcrumbsContainer}`}>
        {/* Top section: all items except the last */}
        <div className={styles.topSection}>
          {allButLast.map((item, index) => (
            <div key={index} className={styles.itemWrapper}>
              <div
                className={`${styles.item} ${styles.regularItem} ${classNameBreadcrumbItem}`}
                onClick={item.onClick}
              >
                {item.displayName}
              </div>
              <div className={styles.separator}>/</div>
            </div>
          ))}
        </div>
        
        {/* Bottom section: the last item */}
        <div className={styles.bottomSection}>
          <div className={styles.itemWrapper}>
            <div
              ref={lastItemRef}
              className={`${styles.item} ${styles.lastItem} ${classNameBreadcrumbItem}`}
              onClick={handleLastItemClick}
            >
              {lastItem.displayName}
            </div>
          </div>
        </div>
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
