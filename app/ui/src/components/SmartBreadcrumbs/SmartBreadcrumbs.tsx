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
  classNameBreadcrumbLastItem?: string;
  compact?: boolean;
}

export const SmartBreadcrumbs: FC<SmartBreadcrumbsProps> = ({ items, onEditLastItem, classNameSmartBreadcrumbsContainer, classNameBreadcrumbItem, classNameBreadcrumbLastItem, compact = false }) => {
  const lastItemRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorPosition, setEditorPosition] = useState({ x: 0, y: 0 });
  const [editingValue, setEditingValue] = useState('');

  const [elementHeight, setElementHeight] = useState(0);
  const [elementWidth, setElementWidth] = useState(0);
  const [fontSize, setFontSize] = useState('16px');
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleLastItemClick = (e: React.MouseEvent) => {
    if (onEditLastItem && lastItemRef.current) {
      const rect = lastItemRef.current.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(lastItemRef.current);
      
      const x = rect.left;
      const y = rect.top; // Use top instead of bottom to overlap
      const height = rect.height;
      const width = rect.width;
      const elementFontSize = computedStyle.fontSize;
      
      // Calculate cursor position based on click location within the text
      const clickX = e.clientX - rect.left;
      const text = items[items.length - 1].displayName;
      
      // Create a temporary span to measure character positions
      const measureSpan = document.createElement('span');
      measureSpan.style.visibility = 'hidden';
      measureSpan.style.position = 'absolute';
      measureSpan.style.fontSize = elementFontSize;
      measureSpan.style.fontFamily = computedStyle.fontFamily;
      measureSpan.style.fontWeight = computedStyle.fontWeight;
      document.body.appendChild(measureSpan);
      
      // Find the character position closest to the click
      let position = 0;
      for (let i = 0; i <= text.length; i++) {
        measureSpan.textContent = text.substring(0, i);
        const charWidth = measureSpan.offsetWidth;
        if (charWidth >= clickX) {
          position = i;
          break;
        }
        position = i;
      }
      
      document.body.removeChild(measureSpan);
      
      setEditingValue(text);
      setEditorPosition({ x, y });
      setElementHeight(height);
      setElementWidth(width);
      setFontSize(elementFontSize);
      setCursorPosition(position);
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
      <div className={`${styles.container} ${compact ? styles.compactContainer : ''} ${classNameSmartBreadcrumbsContainer}`}>
        {compact ? (
          // Compact mode: single line with all items
          <div className={styles.compactSection}>
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
            <div className={styles.itemWrapper}>
              <div
                ref={lastItemRef}
                className={`${styles.item} ${styles.lastItem} ${classNameBreadcrumbLastItem}`}
                onClick={handleLastItemClick}
              >
                {lastItem.displayName}
              </div>
            </div>
          </div>
        ) : (
          // Normal mode: split layout
          <>
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
                  className={`${styles.item} ${styles.lastItem} ${classNameBreadcrumbLastItem}`}
                  onClick={handleLastItemClick}
                >
                  {lastItem.displayName}
                </div>
              </div>
            </div>
          </>
        )}
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
          height={elementHeight}
          width={elementWidth}
          fontSize={fontSize}
          initialCursorPosition={cursorPosition}
        />
      )}
    </>
  );
};
