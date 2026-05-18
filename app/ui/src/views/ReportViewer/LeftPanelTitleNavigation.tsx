import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { Portal } from '../../components/Portal/Portal';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { type OutlineEntry } from './OutlineBar';
import { type SequentialRow } from './studyRegistryUtils';
import styles from './LeftPanelTitleNavigation.module.css';

interface LeftPanelTitleNavigationProps {
  studyTitle: string;
  entries: OutlineEntry[];
  rows: SequentialRow[];
  activeSection?: string | null;
  onOpenRow?: (index: number) => void;
}

export const LeftPanelTitleNavigation: FC<LeftPanelTitleNavigationProps> = ({
  studyTitle,
  entries,
  rows,
  activeSection,
  onOpenRow,
}) => {
  // Derive current category and section from activeSection + entries
  const { activeCategory, activeSectionName, categoryOptions, sectionOptions, rowOptions } = useMemo(() => {
    // Find which category (level 0) the activeSection belongs to
    let category: string | null = null;
    let section: string | null = null;
    let lastLevel0: string | null = null;

    for (const entry of entries) {
      if (entry.level === 0) lastLevel0 = entry.name;
      if (entry.name === activeSection) {
        if (entry.level === 0) {
          category = entry.name;
        } else {
          category = lastLevel0;
          section = entry.name;
        }
        break;
      }
    }

    // Map from display name → category key for SequentialRow lookup
    const CATEGORY_KEY_MAP: Record<string, string> = {
      'Attrition': 'attrition',
      'Baseline characteristics': 'baseline_characteristics',
      'Outcomes': 'outcomes',
    };

    // Category options: all level 0 entries
    const catOpts = entries
      .filter((e) => e.level === 0)
      .map((e) => {
        const catKey = CATEGORY_KEY_MAP[e.name];
        const firstRow = catKey ? rows.find((r) => r.category === catKey) : undefined;
        return {
          label: e.name,
          onClick: () => {
            e.onClick();
            if (onOpenRow && firstRow) onOpenRow(firstRow.index);
          },
        };
      });

    // Section options: level 1 entries under the active category
    const secOpts: { label: string; onClick: () => void }[] = [];
    let inCategory = false;
    for (const entry of entries) {
      if (entry.level === 0) {
        inCategory = entry.name === category;
        continue;
      }
      if (inCategory && entry.level === 1) {
        const firstRow = rows.find((r) => r.section === entry.name);
        secOpts.push({
          label: entry.name,
          onClick: () => {
            entry.onClick();
            if (onOpenRow && firstRow) onOpenRow(firstRow.index);
          },
        });
      }
    }

    // Row options: rows within the active section
    const rowOpts: { label: string; onClick: () => void }[] = [];
    if (section && onOpenRow) {
      for (const row of rows) {
        if (row.section === section) {
          const idx = row.index;
          rowOpts.push({
            label: row.registry?.display_name || row.name,
            onClick: () => onOpenRow(idx),
          });
        }
      }
    }

    return {
      activeCategory: category,
      activeSectionName: section,
      categoryOptions: catOpts,
      sectionOptions: secOpts,
      rowOptions: rowOpts,
    };
  }, [entries, rows, activeSection, onOpenRow]);

  return (
    <div className={styles.container}>
      <Crumb
        label={studyTitle}
        activeLabel={activeCategory ?? ''}
        options={categoryOptions}
        level="study"
      />
      {activeCategory && (
        <Crumb
          label={activeCategory}
          activeLabel={activeSectionName ?? ''}
          options={sectionOptions}
          level="category"
        />
      )}
      {activeSectionName && (
        <Crumb
          label={activeSectionName}
          activeLabel=""
          options={rowOptions}
          level="section"
        />
      )}
    </div>
  );
};

/* ── Crumb with popover menu ─────────────────────────────────────────── */

interface CrumbOption {
  label: string;
  onClick: () => void;
}

interface CrumbProps {
  label: string;
  activeLabel: string;
  options: CrumbOption[];
  level: 'study' | 'category' | 'section';
}

const Crumb: FC<CrumbProps> = ({ label, activeLabel, options, level }) => {
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

  const handleSelect = useCallback((opt: CrumbOption) => {
    opt.onClick();
  }, []);

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
  options: CrumbOption[];
  currentLabel: string;
  onSelect: (opt: CrumbOption) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const CrumbMenu: FC<CrumbMenuProps> = ({
  anchorEl, menuRef, options, currentLabel, onSelect, onMouseEnter, onMouseLeave,
}) => {
  const rect = anchorEl.getBoundingClientRect();
  const scrollRef = useRef<HTMLDivElement>(null);

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
          {options.map((opt, i) => (
            <button
              key={i}
              className={`${styles.menuItem} ${opt.label === currentLabel ? styles.menuItemActive : ''}`}
              onClick={(e) => { e.stopPropagation(); onSelect(opt); }}
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
