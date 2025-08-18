import { FC } from 'react';
import styles from './XButton.module.css';

interface XButtonProps {
  onClick: () => void;
  className?: string;
}

export const XButton: FC<XButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button className={`${styles.xButton} ${className}`} onClick={onClick}>
      ×
    </button>
  );
};
