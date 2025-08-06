import { FC } from 'react';
import styles from './XButton.module.css';

interface XButtonProps {
  onClick: () => void;
  title?: string;  // for accessibility and tooltips
  className?: string;
}

export const XButton: FC<XButtonProps> = ({ 
  onClick, 
  title = 'Close', 
  className = '' 
}) => {
  return (
    <button
      className={`${styles.xButton} ${className}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      ×
    </button>
  );
};
