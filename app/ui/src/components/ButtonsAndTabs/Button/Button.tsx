import { FC } from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  onClick: () => void;
  title?: string; // for accessibility and tooltips
  className?: string;
}

export const Button: FC<ButtonProps> = ({ onClick, title = 'Close', className = '' }) => {
  return (
    <button
      className={`${styles.button} ${className}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {title}
    </button>
  );
};
