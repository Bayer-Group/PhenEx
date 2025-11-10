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
}) => {
  const [localValue, setLocalValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Auto-focus the input when the popup mounts
  useEffect(() => {
    // Wait for the portal to render and find the input
    const timer = setTimeout(() => {
      const input = containerRef.current?.querySelector('input');
      if (input) {
        input.focus();
        input.select(); // Also select all text for easy editing
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

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

  return (
    <DraggablePortal
      initialX={x}
      initialY={y}
      dragHandleSelector={dragHandleSelector}
      enableDragging={true}
    >
      <div ref={containerRef} className={`${styles.container} ${className || ''}`}>
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
          />
        </div>
      </div>
    </DraggablePortal>
  );
};
