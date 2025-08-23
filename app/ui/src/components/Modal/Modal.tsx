import { FC, useEffect, useState, ReactNode } from 'react';
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
  closeOnBackgroundClick = true
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      setIsClosing(false);
    }
  }, [isVisible]);

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackgroundClick) return;
    
    console.log("Modal background clicked");
    console.log("Target:", e.target);
    console.log("Current target:", e.currentTarget);
    
    // Start closing animation
    handleClose();
  };

  const handleClose = () => {
    console.log("Starting modal close animation");
    setIsClosing(true);
    setIsAnimating(false); // This will trigger the fade out
    
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      console.log("Modal close animation complete, calling onClose");
      onClose();
    }, 300); // Match the CSS transition duration
  };

  if (!isVisible && !isClosing) {
    return null;
  }

  return (
    <Portal>
      <div 
        className={`${styles.overlay} ${(isAnimating && !isClosing) ? styles.visible : ''} ${className}`}
      >
        <div 
          className={styles.blurBackground} 
          onClick={handleBackgroundClick}
        />
        <div 
          className={`${styles.content} ${contentClassName}`}
          style={{
            maxWidth,
            maxHeight,
            minWidth
          }}
          onClick={(e) => {
            console.log("Modal content clicked - stopping propagation");
            e.stopPropagation();
          }}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
};
