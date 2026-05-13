import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { Portal } from '../../../../components/Portal/Portal';
import { type SequentialRow } from '../../studyRegistryUtils';
import styles from './HorizontalRowTitle.module.css';

/* ── Props ───────────────────────────────────────────────────────────── */

interface HorizontalRowTitleProps {
  rows: SequentialRow[];
  currentIndex: number;
  desiredTop: string;
  onNavigate: (index: number) => void;
}

/* ── Crumb with popover menu ─────────────────────────────────────────── */

interface CrumbProps {
  label: string;
  options: { label: string; index: number }[];
  isLast: boolean;
  onNavigate: (index: number) => void;
}

const Crumb: FC<CrumbProps> = ({ label, options, isLast, onNavigate }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      if (!menuRef.current?.matches(':hover')) setOpen(false);
    }, 120);
  }, []);

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  const handleSelect = useCallback((idx: number) => {
    setOpen(false);
    onNavigate(idx);
  }, [onNavigate]);

  // Only show menu if there are alternative options
  const hasMenu = options.length > 1;

  return (
    <div className={styles.crumbWrapper}>
      <button
        ref={ref}
        className={`${styles.crumb} ${isLast ? styles.crumbLast : ''} ${open ? styles.crumbActive : ''}`}
        onMouseEnter={() => { cancelClose(); if (hasMenu) setOpen(true); }}
        onMouseLeave={scheduleClose}
        onClick={() => { if (hasMenu) setOpen((o) => !o); }}
      >
        {label}
      </button>
      {open && hasMenu && ref.current && (
        <CrumbMenu
          anchorEl={ref.current}
          menuRef={menuRef}
          options={options}
          currentLabel={label}
          onSelect={handleSelect}
          onMouseEnter={cancelClose}
          onMouseLeave={() => setOpen(false)}
        />
      )}
    </div>
  );
};

/* ── Popover menu (portal-based) ─────────────────────────────────────── */

interface CrumbMenuProps {
  anchorEl: HTMLElement;
  menuRef: React.RefObject<HTMLDivElement | null>;
  options: { label: string; index: number }[];
  currentLabel: string;
  onSelect: (index: number) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const CrumbMenu: FC<CrumbMenuProps> = ({
  anchorEl, menuRef, options, currentLabel, onSelect, onMouseEnter, onMouseLeave,
}) => {
  const rect = anchorEl.getBoundingClientRect();

  return (
    <Portal>
      <div
        ref={menuRef}
        className={styles.menu}
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.right + 8,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {options.map((opt) => (
          <button
            key={opt.index}
            className={`${styles.menuItem} ${opt.label === currentLabel ? styles.menuItemActive : ''}`}
            onClick={(e) => { e.stopPropagation(); onSelect(opt.index); }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Portal>
  );
};

/* ── Main component ──────────────────────────────────────────────────── */

export const HorizontalRowTitle: FC<HorizontalRowTitleProps> = ({
  rows, currentIndex, desiredTop, onNavigate,
}) => {
  const current = rows[currentIndex];
  if (!current) return null;

  // Build option lists for each crumb level
  const { sectionOptions, rowOptions } = useMemo(() => {
    // Sections: unique sections, first row index for each
    const secMap = new Map<string, number>();
    for (const r of rows) {
      const sec = r.section ?? '(ungrouped)';
      if (!secMap.has(sec)) secMap.set(sec, r.index);
    }
    const sectionOpts = Array.from(secMap, ([label, index]) => ({ label, index }));

    // Rows within the current section
    const curSec = current.section;
    const rowOpts = rows
      .filter((r) => r.section === curSec)
      .map((r) => ({
        label: r.registry?.display_name || r.name,
        index: r.index,
      }));

    return { sectionOptions: sectionOpts, rowOptions: rowOpts };
  }, [rows, currentIndex, current]);

  const displayName = current.registry?.display_name || current.name;
  const sectionLabel = current.section ?? '(ungrouped)';

  return (
    <div
      className={styles.container}
      style={{ paddingTop: desiredTop }}
      onClick={(e) => e.stopPropagation()}
    >
      {current.section && (
        <Crumb
          label={sectionLabel}
          options={sectionOptions}
          isLast={false}
          onNavigate={onNavigate}
        />
      )}
      <Crumb
        label={displayName}
        options={rowOptions}
        isLast
        onNavigate={onNavigate}
      />
    </div>
  );
};
