import { FC, useRef, useState } from 'react';
import styles from './SmartTextField.module.css';
import { PopupEditableTextField } from '../PopupEditableTextField';

interface SmartTextFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
}

export const SmartTextField: FC<SmartTextFieldProps> = ({ 
  value, 
  onSave, 
  placeholder = 'Enter text...', 
  className 
}) => {
  const textRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorPosition, setEditorPosition] = useState({ x: 0, y: 0 });
  const [editingValue, setEditingValue] = useState('');

  const [elementHeight, setElementHeight] = useState(0);
  const [elementWidth, setElementWidth] = useState(0);
  const [fontSize, setFontSize] = useState('16px');
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleClick = (e: React.MouseEvent) => {
    if (textRef.current) {
      const rect = textRef.current.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(textRef.current);
      
      const x = rect.left;
      const y = rect.top;
      const height = rect.height;
      const width = rect.width;
      const elementFontSize = computedStyle.fontSize;
      
      // Calculate cursor position based on click location within the text
      const clickX = e.clientX - rect.left;
      const text = value;
      
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
    }
  };

  const handleSave = (newValue: string) => {
    onSave(newValue);
    setShowEditor(false);
  };

  const handleClose = () => {
    setShowEditor(false);
  };

  return (
    <>
      <div
        ref={textRef}
        className={`${styles.textField} ${className || ''}`}
        onClick={handleClick}
      >
        {value || placeholder}
      </div>
      
      {showEditor && (
        <PopupEditableTextField
          value={editingValue}
          x={editorPosition.x}
          y={editorPosition.y}
          onChange={setEditingValue}
          onSave={handleSave}
          onClose={handleClose}
          placeholder={placeholder}
          height={elementHeight}
          width={elementWidth}
          fontSize={fontSize}
          initialCursorPosition={cursorPosition}
        />
      )}
    </>
  );
};
