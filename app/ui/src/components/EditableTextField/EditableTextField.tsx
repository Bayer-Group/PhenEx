import { FC, useState, useRef } from 'react';
import styles from './EditableTextField.module.css';

interface EditableTextFieldProps {
  value: string;
  placeholder?: string;
  onChange: (newValue: string) => void;
  onSaveChanges: () => void;
  className?: string;
}

export const EditableTextField: FC<EditableTextFieldProps> = ({
  value,
  placeholder,
  onChange,
  onSaveChanges,
  className,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onSaveChanges();
    setIsFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className={`${styles.container} ${isFocused ? styles.focused : ''} ${className || ''}`}>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        // onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        onBlur={() => handleSave()}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            handleSave();
          }
        }}
      />
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
