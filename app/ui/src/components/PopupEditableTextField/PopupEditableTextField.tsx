import { FC, useState, useEffect, useRef } from 'react';
import { DraggablePortal } from '../Portal/DraggablePortal';
import { EditableTextField } from '../EditableTextField/EditableTextField';
import styles from './PopupEditableTextField.module.css';

interface PopupEditableTextFieldProps {
  value: string;
  placeholder?: string;
  x: number;
  y: number;
  onChange: (newValue: string) => void;
  onSave: (finalValue: string) => void;
  onClose: () => void;
  dragHandleSelector?: string;
  className?: string;
  classNameInput?: string;
  height?: number;
  width?: number;
  fontSize?: string;
  initialCursorPosition?: number;
}

export const PopupEditableTextField: FC<PopupEditableTextFieldProps> = ({
  value,
  placeholder = 'Enter text...',
  x,
  y,
  onChange,
  onSave,
  onClose,
  dragHandleSelector = '.popup-drag-handle',
  className,
  classNameInput,
  height,
  width,
  fontSize,
  initialCursorPosition,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Auto-focus the input when the popup mounts and set cursor position
  useEffect(() => {
    // Wait for the portal to render and find the input/textarea
    const timer = setTimeout(() => {
      const input = containerRef.current?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
      if (input) {
        input.focus();
        
        // Set cursor position if provided, otherwise select all
        if (initialCursorPosition !== undefined) {
          input.setSelectionRange(initialCursorPosition, initialCursorPosition);
        } else {
          input.select(); // Select all text for easy editing if no position specified
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [initialCursorPosition]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleSave = () => {
    onSave(localValue);
    onClose();
  };

  const handleCancel = () => {
    setLocalValue(value); // Reset to original value
    onClose();
  };

  const [currentWidth, setCurrentWidth] = useState(width || 200);
  const [currentHeight, setCurrentHeight] = useState(height || 32);
  const maxWidth = 600;

  // Create dynamic styles based on the calling element
  const containerStyle: React.CSSProperties = {
    minHeight: height ? `${height}px` : 'auto',
    minWidth: width ? `${width}px` : 'auto',
    maxWidth: `${maxWidth}px`,
    width: `${currentWidth}px`,
    height: 'auto',
  };

  // Apply dynamic styles to the input/textarea field and handle auto-sizing
  useEffect(() => {
    if (containerRef.current) {
      const input = containerRef.current.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
      if (input) {
        if (fontSize) {
          input.style.fontSize = fontSize;
        }
        
        // Create a temporary span to measure text width
        const measureSpan = document.createElement('span');
        measureSpan.style.visibility = 'hidden';
        measureSpan.style.position = 'absolute';
        measureSpan.style.whiteSpace = 'pre';
        measureSpan.style.fontSize = fontSize || '16px';
        measureSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;
        measureSpan.textContent = localValue || placeholder || '';
        document.body.appendChild(measureSpan);
        
        const textWidth = measureSpan.offsetWidth + 40; // Add padding
        document.body.removeChild(measureSpan);
        
        // Expand width up to maxWidth
        if (textWidth > (width || 200) && textWidth <= maxWidth) {
          setCurrentWidth(textWidth);
          input.style.width = `${textWidth}px`;
        } else if (textWidth > maxWidth) {
          setCurrentWidth(maxWidth);
          input.style.width = `${maxWidth}px`;
          // Enable wrapping when max width reached
          if (input instanceof HTMLTextAreaElement) {
            input.style.whiteSpace = 'pre-wrap';
            input.style.overflowWrap = 'break-word';
            // Auto-resize height
            input.style.height = 'auto';
            input.style.height = `${input.scrollHeight}px`;
            setCurrentHeight(input.scrollHeight);
          }
        } else {
          setCurrentWidth(width || 200);
          input.style.width = `${width || 200}px`;
        }
      }
    }
  }, [fontSize, height, width, localValue, placeholder, maxWidth]);

  return (
    <DraggablePortal
      initialX={x}
      initialY={y}
      dragHandleSelector={dragHandleSelector}
      enableDragging={true}
    >
      <div ref={containerRef} className={`${styles.container} ${className || ''}`} style={containerStyle}>
        <div className={`${styles.dragHandle} popup-drag-handle`}>
          <div className={styles.dragIcon}>⋮⋮</div>
          <div className={styles.title}>Edit</div>
          <button className={styles.closeButton} onClick={handleCancel} type="button">
            ×
          </button>
        </div>
        <div className={styles.content}>
          <EditableTextField
            value={localValue}
            placeholder={placeholder}
            onChange={handleChange}
            onSaveChanges={handleSave}
            className={styles.textField}
            classNameInput={classNameInput}
            multiline={true}
          />
        </div>
      </div>
    </DraggablePortal>
  );
};
