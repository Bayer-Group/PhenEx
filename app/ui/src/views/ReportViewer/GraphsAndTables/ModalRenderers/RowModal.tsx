import { FC, useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { Portal } from '../../../../components/Portal/Portal';
import { SmartBreadcrumbs } from '../../../../components/SmartBreadcrumbs';
import styles from './RowModal.module.css';

const ANIM_MS = 150;

/** Track the last click Y position globally so RowModal can use it on mount. */
let lastClickY = 0.1;
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    lastClickY = e.clientY / window.innerHeight;
  }, true);
}

interface RowModalProps {
  children: React.ReactNode;
  onClose: () => void;
  breadcrumbs?: string[];
  onPrev?: () => void;
  onNext?: () => void;
}

export const RowModal: FC<RowModalProps> = ({ children, onClose, breadcrumbs, onPrev, onNext }) => {
  const [closing, setClosing] = useState(false);
  const mountY = useRef(lastClickY);
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalH, setModalH] = useState(400);

  const desiredTop = `${Math.min(Math.round(mountY.current * 60), 40)}vh`;

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setModalH(entry.borderBoxSize[0].blockSize));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      if (e.key === 'ArrowLeft' && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === 'ArrowRight' && onNext) { e.preventDefault(); onNext(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [startClose, onPrev, onNext]);

  return (
    <Portal>
      <div
        className={`${styles.overlay} ${closing ? styles.closing : ''}`}
        onClick={handleOverlayClick}
      >
        <div
          ref={modalRef}
          className={styles.modal}
          style={{ '--desired-top': desiredTop, '--modal-h': `${modalH}px` } as React.CSSProperties}
        >
          {bcItems.length > 0 && (
            <SmartBreadcrumbs
              items={bcItems}
              compact={true}
              classNameSmartBreadcrumbsContainer={styles.breadcrumbs}
              classNameBreadcrumbItem={styles.crumb}
              classNameBreadcrumbLastItem={styles.crumbLast}
            />
          )}
          <div className={styles.rowContent}>
            {(onPrev || onNext) && (
              <div className={styles.navRow}>
                <button
                  className={styles.navButton}
                  onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                  disabled={!onPrev}
                  aria-label="Previous row"
                >←</button>
                <button
                  className={styles.navButton}
                  onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                  disabled={!onNext}
                  aria-label="Next row"
                >→</button>
              </div>
            )}
            <div className={styles.cardTitle}>{bcItems[bcItems.length - 1]?.displayName}</div>{children}</div>
        </div>
      </div>
    </Portal>
  );
};
