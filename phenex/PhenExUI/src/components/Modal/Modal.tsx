import { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  isVisible?: boolean;
  position?: {
    x: number;
    y: number;
  };
  size?: {
    width: number | string;
    height: number | string;
  };
  onShow?: () => void;
  onHide?: () => void;
  children?: ReactNode;
}

export const Modal: FC<ModalProps> = ({
  isVisible = false,
  position = { x: 50, y: 50 },
  size = { width: 600, height: 300 },
  onShow,
  onHide,
  children,
}) => {
  const [isActive, setIsActive] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      show();
    } else {
      hide();
    }
  }, [isVisible]);

  const show = useCallback(() => {
    setIsActive(true);
    onShow?.();
  }, [onShow]);

  const hide = useCallback(() => {
    setIsActive(false);
    onHide?.();
  }, [onHide]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        hide();
      }
    },
    [hide]
  );

  if (!isActive) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.content}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: typeof size.width === 'number' ? `${size.width}px` : size.width,
          height: typeof size.height === 'number' ? `${size.height}px` : size.height,
        }}
      >
        {children}
      </div>
    </div>
  );
};
