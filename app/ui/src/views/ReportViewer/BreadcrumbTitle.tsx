import { FC, useMemo } from 'react';
import { type ViewerEntry, getEntryCategory, getEntrySection } from './studyRegistryUtils';
import styles from './BreadcrumbTitle.module.css';

/* ── Display names for raw category keys ─────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  attrition: 'Attrition',
  baseline_characteristics: 'Baseline Characteristics',
  outcomes: 'Outcomes',
};

/* ── Props ───────────────────────────────────────────────────────────── */

interface BreadcrumbTitleProps {
  entries: ViewerEntry[];
  currentIndex: number;
  studyTitle?: string;
  onNavigate: (index: number) => void;
}

/* ── Simple clickable crumb ──────────────────────────────────────────── */

interface CrumbProps {
  label: string;
  level: 'study' | 'category' | 'section';
  onClick: () => void;
}

const Crumb: FC<CrumbProps> = ({ label, level, onClick }) => (
  <button
    className={`${styles.crumb} ${styles[`crumb_${level}`]}`}
    onClick={onClick}
  >
    {label}
  </button>
);

/* ── Main component ──────────────────────────────────────────────────── */

export const BreadcrumbTitle: FC<BreadcrumbTitleProps> = ({
  entries, currentIndex, studyTitle = 'Loading study...', onNavigate,
}) => {
  const current = entries[currentIndex];

  // Compute jump targets for category and section crumbs
  const { categoryIndex, sectionIndex } = useMemo(() => {
    if (!current) return { categoryIndex: 0, sectionIndex: 0 };
    const currentCategory = getEntryCategory(current);
    const currentSection = getEntrySection(current);

    // First entry index for the current category
    const catIdx = entries.find((e) => getEntryCategory(e) === currentCategory)?.index ?? 0;

    // First entry index for the current section within the category
    const secIdx = currentSection
      ? (entries.find(
          (e) => getEntryCategory(e) === currentCategory && getEntrySection(e) === currentSection,
        )?.index ?? catIdx)
      : catIdx;

    return { categoryIndex: catIdx, sectionIndex: secIdx };
  }, [entries, current]);

  if (!current) return null;

  const categoryLabel = CATEGORY_LABELS[getEntryCategory(current)] ?? getEntryCategory(current);
  const sectionLabel = getEntrySection(current);

  return (
    <div
      className={styles.container}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Level 1: Study name → study info (index 0) */}
      <Crumb
        label={studyTitle}
        level="study"
        onClick={() => onNavigate(0)}
      />
      <span className={styles.separator}>/</span>

      {/* Level 2: Category → first entry of current category */}
      <Crumb
        label={categoryLabel}
        level="category"
        onClick={() => onNavigate(categoryIndex)}
      />

      {/* Level 3: Section → first entry of current section */}
      {sectionLabel && (
        <>
          <span className={styles.separator}>/</span>
          <Crumb
            label={sectionLabel}
            level="section"
            onClick={() => onNavigate(sectionIndex)}
          />
        </>
      )}
    </div>
  );
};
