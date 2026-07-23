import { FC, ReactNode } from 'react';
import { Portal } from '../Portal/Portal';
import styles from './Modal.module.css';

interface ModalProps {
  isVisible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  minWidth?: string;
  className?: string;
  contentClassName?: string;
  closeOnBackgroundClick?: boolean;
}

export const Modal: FC<ModalProps> = ({
  isVisible,
  onClose,
  children,
  maxWidth = '80vw',
  maxHeight = '80vh',
  minWidth = '400px',
  className = '',
  contentClassName = '',
  closeOnBackgroundClick = true,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <Portal>
      <div className={`${styles.overlay} ${className}`}>
        <div
          className={styles.blurBackground}
          onClick={closeOnBackgroundClick ? onClose : undefined}
        />
        <div
          className={`${styles.content} ${contentClassName}`}
          style={{ maxWidth, maxHeight, minWidth }}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
};
