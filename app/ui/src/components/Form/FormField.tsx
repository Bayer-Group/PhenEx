import { FC, ReactNode } from 'react';
import styles from './FormField.module.css';

interface FormFieldProps {
  children: ReactNode;
  error?: string;
  className?: string;
}

export const FormField: FC<FormFieldProps> = ({ children, error, className = '' }) => {
  return (
    <div className={`${styles.field} ${className}`}>
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
};
