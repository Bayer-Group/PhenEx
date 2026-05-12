import { FC, ReactNode, useState, useRef, useEffect } from 'react';
import styles from './ReportNavPanelCard.module.css';

interface ReportNavPanelCardProps {
  title: string;
  children: ReactNode;
  background?: boolean;
}

export const ReportNavPanelCard: FC<ReportNavPanelCardProps> = ({ title, background = false, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!collapsed) setHeight(el.scrollHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed]);

  return (
    <div className={styles.card + (background ? ` ${styles.background}` : '')}>
      <div className={styles.titleRow}>
        <div className={styles.title}>{title}</div>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '+' : '\u2013'}
        </button>
      </div>
      <div
        ref={bodyRef}
        className={styles.body}
        style={{ maxHeight: collapsed ? 0 : height ?? 'none' }}
      >
        {children}
      </div>
    </div>
  );
};
