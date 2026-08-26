import { FC, useState, useRef } from 'react';
import styles from './EditableTextField.module.css';

interface EditableTextFieldProps {
  value: string;
  placeholder?: string;
  onChange: (newValue: string) => void;
  onSaveChanges: () => void;
  className?: string;
  classNameInput?: string;
  multiline?: boolean;
}

export const EditableTextField: FC<EditableTextFieldProps> = ({
  value,
  placeholder,
  onChange,
  onSaveChanges,
  className,
  classNameInput = '',
  multiline = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = () => {
    onSaveChanges();
    setIsFocused(false);
    if (multiline) {
      textareaRef.current?.blur();
    } else {
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`${styles.container} ${isFocused ? styles.focused : ''} ${className || ''}`}>
      {multiline ? (
        <textarea
          ref={textareaRef}
          className={`${styles.input} ${classNameInput}`}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => handleSave()}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
          }}
          rows={1}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          className={`${styles.input} ${classNameInput}`}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => handleSave()}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleSave();
            }
          }}
        />
      )}
      {isFocused && (
        <div
          className={styles.saveIndicator}
          onClick={e => {
            console.log('CLICKING SAVE HERE');
            e.preventDefault();
            e.stopPropagation();
            handleSave();
          }}
        >
          press enter to <span className={styles.saveText}>save</span>
        </div>
      )}
    </div>
  );
};
