import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { Portal } from '../../../components/Portal/Portal';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { type ViewerEntry, getEntryCategory, getEntrySection, getEntryLabel } from '../studyRegistryUtils';
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
  entries: ViewerEntry[];
  currentIndex: number;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view when menu opens
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) {
      const active = el.querySelector(`.${styles.menuItemActive}`) as HTMLElement | null;
      if (active) {
        requestAnimationFrame(() => active.scrollIntoView({ block: 'nearest' }));
      }
    }
  }, []);

  return (
    <Portal>
      <div
        ref={menuRef}
        className={styles.menu}
        style={{
          position: 'fixed',
          top: rect.bottom,
          left: rect.left,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div ref={setScrollRef} className={styles.menuScroll}>
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
        <SimpleCustomScrollbar
          targetRef={scrollRef}
          orientation="vertical"
          marginTop={10}
          marginBottom={0}
          marginToEnd={8}
        />
      </div>
    </Portal>
  );
};

/* ── Main component ──────────────────────────────────────────────────── */

export const HorizontalRowTitle: FC<HorizontalRowTitleProps> = ({
  entries, currentIndex, studyTitle = 'Loading study...', onNavigate,
}) => {
  const current = entries[currentIndex];

  // Build option lists for each level (entry-index based navigation targets)
  const { categoryOptions, sectionOptions, rowOptions } = useMemo(() => {
    const currentCategory = current ? getEntryCategory(current) : null;
    const currentSection = current ? getEntrySection(current) : null;

    // Categories: first entry index per category key
    const catMap = new Map<string, number>();
    for (const e of entries) {
      const cat = getEntryCategory(e);
      if (!catMap.has(cat)) catMap.set(cat, e.index);
    }
    const catEntries = CAT_KEYS
      .filter((key) => catMap.has(key))
      .map((key) => ({ label: CATEGORY_LABELS[key] ?? key, index: catMap.get(key)! }));

    // Sections within the current category: first entry index per section
    const secMap = new Map<string, number>();
    for (const e of entries) {
      const sec = getEntrySection(e);
      if (getEntryCategory(e) === currentCategory && sec && !secMap.has(sec)) {
        secMap.set(sec, e.index);
      }
    }
    const secOpts = Array.from(secMap, ([label, index]) => ({ label, index }));

    // Individual rows within the current section
    const rOpts = entries
      .filter((e) => e.kind === 'row' && getEntrySection(e) === currentSection && currentSection !== null)
      .map((e) => ({ label: getEntryLabel(e), index: e.index }));

    return { categoryOptions: catEntries, sectionOptions: secOpts, rowOptions: rOpts };
  }, [entries, current]);

  if (!current) return null;

  const categoryLabel = CATEGORY_LABELS[getEntryCategory(current)] ?? getEntryCategory(current);
  const sectionLabel = getEntrySection(current);
  const activeRowLabel = current.kind === 'row' ? getEntryLabel(current) : '';

  return (
    <div
      className={styles.container}
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
      <span className={styles.separator}>/</span>

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
        <>
          <span className={styles.separator}>/</span>
          <Crumb
            label={sectionLabel}
            activeLabel={activeRowLabel}
            options={rowOptions}
            level="section"
            onNavigate={onNavigate}
          />
        </>
      )}
    </div>
  );
};
