import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { Portal } from '../../../../components/Portal/Portal';
import { type SequentialRow } from '../../studyRegistryUtils';
import styles from './HorizontalRowTitle.module.css';

/* ── Display names for raw category keys ─────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  attrition: 'Attrition',
  baseline_characteristics: 'Baseline Characteristics',
  outcomes: 'Outcomes',
};

const CAT_KEYS = ['attrition', 'baseline_characteristics', 'outcomes'] as const;

/* ── Props ───────────────────────────────────────────────────────────── */

interface HorizontalRowTitleProps {
  rows: SequentialRow[];
  currentIndex: number;
  desiredTop: string;
  studyTitle?: string;
  onNavigate: (index: number) => void;
}

/* ── Crumb with popover menu ─────────────────────────────────────────── */

interface CrumbProps {
  label: string;
  activeLabel: string;
  options: { label: string; index: number }[];
  level: 'study' | 'category' | 'section';
  onNavigate: (index: number) => void;
}

const Crumb: FC<CrumbProps> = ({ label, activeLabel, options, level, onNavigate }) => {
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

  const hasMenu = options.length > 0;

  return (
    <div className={styles.crumbWrapper}>
      <button
        ref={ref}
        className={`${styles.crumb} ${styles[`crumb_${level}`]} ${open ? styles.crumbActive : ''}`}
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
          currentLabel={activeLabel}
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

  // Scroll active item into view when menu opens
  const setMenuRef = useCallback((el: HTMLDivElement | null) => {
    (menuRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) {
      const active = el.querySelector(`.${styles.menuItemActive}`) as HTMLElement | null;
      if (active) {
        // Delay so layout is settled
        requestAnimationFrame(() => active.scrollIntoView({ block: 'nearest' }));
      }
    }
  }, [menuRef]);

  return (
    <Portal>
      <div
        ref={setMenuRef}
        className={styles.menu}
        style={{
          position: 'fixed',
          top: rect.bottom,
          left: rect.left,
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
  rows, currentIndex, desiredTop, studyTitle = 'LUMINOUS', onNavigate,
}) => {
  const current = rows[currentIndex];
  if (!current) return null;

  const categoryLabel = CATEGORY_LABELS[current.category] ?? current.category;
  const sectionLabel = current.section;

  // Build option lists for each level
  const { categoryOptions, sectionOptions, rowOptions } = useMemo(() => {
    // Categories: first row index per category key
    const catMap = new Map<string, number>();
    for (const r of rows) {
      if (!catMap.has(r.category)) catMap.set(r.category, r.index);
    }
    const catEntries = CAT_KEYS
      .filter((key) => catMap.has(key))
      .map((key) => ({
        label: CATEGORY_LABELS[key] ?? key,
        index: catMap.get(key)!,
      }));

    // Sections within the current category
    const secMap = new Map<string, number>();
    for (const r of rows) {
      if (r.category === current.category && r.section && !secMap.has(r.section)) {
        secMap.set(r.section, r.index);
      }
    }
    const secOpts = Array.from(secMap, ([label, index]) => ({ label, index }));

    // Rows within the current section
    const curSec = current.section;
    const rOpts = rows
      .filter((r) => r.section === curSec)
      .map((r) => ({
        label: r.registry?.display_name || r.name,
        index: r.index,
      }));

    return { categoryOptions: catEntries, sectionOptions: secOpts, rowOptions: rOpts };
  }, [rows, currentIndex, current]);

  return (
    <div
      className={styles.container}
    //   style={{ paddingTop: desiredTop }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Level 1: Study name — menu shows categories */}
      <Crumb
        label={studyTitle}
        activeLabel={categoryLabel}
        options={categoryOptions}
        level="study"
        onNavigate={onNavigate}
      />

      {/* Level 2: Category — menu shows sections */}
      <Crumb
        label={categoryLabel}
        activeLabel={sectionLabel ?? ''}
        options={sectionOptions}
        level="category"
        onNavigate={onNavigate}
      />

      {/* Level 3: Section — menu shows rows in this section */}
      {sectionLabel && (
        <Crumb
          label={sectionLabel}
          activeLabel={current.registry?.display_name || current.name}
          options={rowOptions}
          level="section"
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};
