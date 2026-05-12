import { FC, useEffect, useCallback, useState, useMemo } from 'react';
import { Portal } from '../../../components/Portal/Portal';
import { SmartBreadcrumbs } from '../../../components/SmartBreadcrumbs';
import styles from './RowModal.module.css';

const ANIM_MS = 150;

interface RowModalProps {
  children: React.ReactNode;
  onClose: () => void;
  breadcrumbs?: string[];
}

export const RowModal: FC<RowModalProps> = ({ children, onClose, breadcrumbs }) => {
  const [closing, setClosing] = useState(false);

  const bcItems = useMemo(
    () => (breadcrumbs ?? []).map((b) => ({ displayName: b, onClick: () => {} })),
    [breadcrumbs],
  );

  const startClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, ANIM_MS);
  }, [closing, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.target === e.currentTarget) startClose();
    },
    [startClose],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') startClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [startClose]);

  return (
    <Portal>
      <div
        className={`${styles.overlay} ${closing ? styles.closing : ''}`}
        onClick={handleOverlayClick}
      >
        <div className={styles.modal}>
          {bcItems.length > 0 && (
            <SmartBreadcrumbs
              items={bcItems}
              classNameSmartBreadcrumbsContainer={styles.breadcrumbs}
              classNameBreadcrumbItem={styles.crumb}
              classNameBreadcrumbLastItem={styles.crumbLast}
            />
          )}
          <div className={styles.rowContent}>{children}</div>
        </div>
      </div>
    </Portal>
  );
};
