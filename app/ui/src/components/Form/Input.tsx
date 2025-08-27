import { InputHTMLAttributes, forwardRef } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: boolean;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className={styles.container}>
        {label && (
          <label className={styles.label} htmlFor={props.id}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`${styles.input} ${error ? styles.error : ''} ${className}`}
          {...props}
        />
        {helperText && (
          <span className={`${styles.helperText} ${error ? styles.errorText : ''}`}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
