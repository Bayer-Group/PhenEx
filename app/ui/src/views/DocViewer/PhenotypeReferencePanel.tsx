import React, { createContext, useCallback, useContext, useRef, useLayoutEffect, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import classDefinitionsRaw from '/assets/class_definitions.json?raw';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import phenotypeDescriptionsRaw from '/assets/phenotype_descriptions.json?raw';
import phenotypeExamplesRaw from '/assets/phenotype_examples.json?raw';
import styles from './DocViewer.module.css';
import { PhenExNavBarMenu } from '../../components/PhenExNavBar/PhenExNavBarMenu';

const classDefinitions: Record<string, any[]> = JSON.parse(classDefinitionsRaw);
const parametersInfo: Record<string, any> = JSON.parse(parametersInfoRaw);
const phenotypeDescriptions: Record<string, string> = JSON.parse(phenotypeDescriptionsRaw);
const phenotypeExamples: Record<string, string[]> = JSON.parse(phenotypeExamplesRaw);

// ─── Section / group structure ───────────────────────────────────────────────

export type EntryDef = {
  class: string;
  excludeClasses?: string[];
};

export type GroupDef = {
  root: EntryDef;
  children?: EntryDef[];
};

export type SectionDef = {
  title: string;
  groups: GroupDef[];
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  'Atomic': 'Fundamental phenotypes that map directly to a single concept or measurement in the source data.',
  'Composite': 'Phenotypes built by combining or aggregating other phenotypes using logic or arithmetic.',
  'Atomic Extension': 'Wrappers that augment an atomic phenotype with additional filtering or counting logic.',
  'Time Range': 'Phenotypes that operate over a defined time window, counting or measuring events within it.',
  'User Defined': 'Custom phenotypes supplied directly by the user without a predefined structure.',
};

export const SECTIONS: SectionDef[] = [
  {
    title: 'Atomic',
    groups: [
      {
        root: { class: 'EventPhenotype' },
        children: [
          { class: 'CodelistPhenotype', excludeClasses: ['EventPhenotype'] },
          { class: 'MeasurementPhenotype', excludeClasses: ['EventPhenotype', 'CodelistPhenotype'] },
        ],
      },
      { root: { class: 'CategoricalPhenotype' } },
      { root: { class: 'AgePhenotype' } },
      { root: { class: 'DeathPhenotype' } },
    ],
  },
  {
    title: 'Composite',
    groups: [
      { root: { class: 'LogicPhenotype' } },
      { root: { class: 'ArithmeticPhenotype' } },
      { root: { class: 'ScorePhenotype' } },
    ],
  },
  {
    title: 'Atomic Extension',
    groups: [
      { root: { class: 'BinPhenotype' } },
      { root: { class: 'EventCountPhenotype' } },
      { root: { class: 'MeasurementChangePhenotype' } },
      { root: { class: 'FurtherValueFilterPhenotype' } },
      { root: { class: 'WithinSameEncounterPhenotype' } },
    ],
  },
  {
    title: 'Time Range',
    groups: [
      { root: { class: 'TimeRangePhenotype' } },
      { root: { class: 'TimeRangeCountPhenotype' } },
      { root: { class: 'TimeRangeDayCountPhenotype' } },
      { root: { class: 'TimeRangeDaysToNextRange' } },
    ],
  },
  {
    title: 'User Defined',
    groups: [{ root: { class: 'UserDefinedPhenotype' } }],
  },
];

// ─── Contexts ─────────────────────────────────────────────────────────────────

const OnExamplesActivateCtx = createContext<(className: string | null) => void>(() => {});
const ActiveClassCtx = createContext<string | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatParamName(param: string): string {
  return param.split('_').join(' ');
}

export function parseClassName(name: string): { title: string; tag: string } {
  const suffixes = ['Phenotype'];
  for (const suffix of suffixes) {
    if (name.endsWith(suffix) && name.length > suffix.length) {
      return {
        title: name.slice(0, -suffix.length).replace(/([A-Z])/g, ' $1').trim(),
        tag: suffix,
      };
    }
  }
  return { title: name.replace(/([A-Z])/g, ' $1').trim(), tag: '' };
}

function getVisibleParams(className: string, excludeClasses: string[] = []): any[] {
  const params = classDefinitions[className] ?? [];
  const excluded = new Set<string>();
  for (const excl of excludeClasses) {
    (classDefinitions[excl] ?? [])
      .filter((p: any) => p.user_visible)
      .forEach((p: any) => excluded.add(p.param));
  }
  return params.filter((p: any) => p.user_visible && !excluded.has(p.param));
}

// ─── Param row ────────────────────────────────────────────────────────────────

const ParamRow: React.FC<{ param: any }> = ({ param }) => {
  const info = parametersInfo[param.param];
  const description = info?.description?.split('.')[0] ?? '';

  return (
    <div className={styles.paramRow}>
      <span className={`${styles.paramName} ${param.required ? styles.required : ''}`}>
        {formatParamName(param.display_name ?? param.param)}
      </span>
      <span className={styles.paramDescription}><ReactMarkdown>{description}</ReactMarkdown></span>
    </div>
  );
};

// ─── ClassCard ────────────────────────────────────────────────────────────────

interface ClassCardProps {
  title: string;
  tag?: string;
  description?: string;
  extendsLabel?: string;
  params: any[];
  hasExamples?: boolean;
  phenotypeName?: string;
}

const ClassCard: React.FC<ClassCardProps> = ({
  title, tag, description, extendsLabel, params, hasExamples, phenotypeName,
}) => {
  const onExamplesActivate = useContext(OnExamplesActivateCtx);
  const activeClass = useContext(ActiveClassCtx);
  const [paramsOpen, setParamsOpen] = useState(false);
  const paramsButtonRef = useRef<HTMLButtonElement>(null);
  const paramsMenuRef = useRef<HTMLDivElement>(null!);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => setParamsOpen(false), 150);
  };

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const dimmed = activeClass !== null && activeClass !== phenotypeName;
  const cardHoverProps = hasExamples && phenotypeName ? {
    onMouseEnter: () => onExamplesActivate(phenotypeName),
    onMouseLeave: () => onExamplesActivate(null),
  } : {};

  return (
    <div className={`${styles.card} ${dimmed ? styles.cardDimmed : ''}`} {...cardHoverProps}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          {title}
          {tag && <span style={{ opacity: 0.1, marginLeft: '6px', fontFamily: 'IBMPlexSans-regular' }}>{tag}</span>}
        </h3>
        {extendsLabel && <span className={styles.extendsBadge}>extends {extendsLabel}</span>}
        {description && <p className={styles.cardDescription}>{description}</p>}
      </div>
      <div className={styles.cardFooter}>
        <button
          ref={paramsButtonRef}
          className={`${styles.cardFooterButton} ${paramsOpen ? styles.cardFooterButtonActive : ''}`}
          onClick={(e) => { e.stopPropagation(); setParamsOpen(v => !v); }}
          onMouseEnter={() => { cancelClose(); setParamsOpen(true); }}
          onMouseLeave={scheduleClose}
        >
          Parameters{params.length > 0 && <span className={styles.cardFooterBadge}>{params.length}</span>}
        </button>
      </div>

      <PhenExNavBarMenu
        isOpen={paramsOpen}
        onClose={() => setParamsOpen(false)}
        anchorElement={paramsButtonRef.current}
        menuRef={paramsMenuRef}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        verticalPosition="below"
        horizontalAlignment="left"
      >
        <div className={styles.popoverContent}>
          {params.length === 0 ? (
            <div className={styles.noParams}>No additional parameters</div>
          ) : (
            <div className={styles.paramList}>
              {params.map((p: any) => <ParamRow key={p.param} param={p} />)}
            </div>
          )}
        </div>
      </PhenExNavBarMenu>
    </div>
  );
};

const PhenotypeCard: React.FC<{ entry: EntryDef; extendsClass?: string }> = ({ entry, extendsClass }) => {
  const params = getVisibleParams(entry.class, entry.excludeClasses);
  const { title, tag } = parseClassName(entry.class);
  const extendsLabel = extendsClass ? parseClassName(extendsClass).title : undefined;
  return (
    <ClassCard
      title={title}
      tag={tag}
      description={phenotypeDescriptions[entry.class]}
      extendsLabel={extendsLabel}
      params={params}
      hasExamples={(phenotypeExamples[entry.class]?.length ?? 0) > 0}
      phenotypeName={entry.class}
    />
  );
};

// ─── MasonryGrid ─────────────────────────────────────────────────────────────

const GAP = 20;
const MIN_COL_WIDTH = 340;

const MasonryGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const doLayoutRef = useRef<() => void>(() => {});

  doLayoutRef.current = () => {
    const el = ref.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    if (!items.length) return;

    const width = el.offsetWidth;
    const cols = Math.max(1, Math.floor((width + GAP) / (MIN_COL_WIDTH + GAP)));
    const colWidth = (width - (cols - 1) * GAP) / cols;
    const heights = Array<number>(cols).fill(0);

    for (const item of items) {
      const col = heights.indexOf(Math.min(...heights));
      item.style.position = 'absolute';
      item.style.width = `${colWidth}px`;
      item.style.left = `${col * (colWidth + GAP)}px`;
      item.style.top = `${heights[col]}px`;
      heights[col] += item.offsetHeight + GAP;
    }

    el.style.height = `${Math.max(...heights) - GAP}px`;
  };

  useLayoutEffect(() => { doLayoutRef.current(); }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onResize = () => doLayoutRef.current();
    const ro = new ResizeObserver(onResize);
    Array.from(el.children).forEach(child => ro.observe(child));
    window.addEventListener('resize', onResize);
    return () => { ro.disconnect(); window.removeEventListener('resize', onResize); };
  }, []);

  return <div ref={ref} className={styles.masonry}>{children}</div>;
};

// ─── Group ────────────────────────────────────────────────────────────────────

const GroupView: React.FC<{ group: GroupDef }> = ({ group }) => {
  const { root, children } = group;
  return (
    <>
      <div className={styles.group}>
        <PhenotypeCard entry={root} />
      </div>
      {children?.map(child => {
        const immediateParent = child.excludeClasses?.[child.excludeClasses.length - 1];
        return (
          <div key={child.class} className={styles.group}>
            <PhenotypeCard entry={child} extendsClass={immediateParent} />
          </div>
        );
      })}
    </>
  );
};

// ─── Section ──────────────────────────────────────────────────────────────────

const SectionView: React.FC<{ section: SectionDef }> = ({ section }) => (
  <div className={styles.section}>
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>
        {section.title} <span className={styles.sectionTitleSuffix}>Phenotypes</span>
      </h2>
      {SECTION_DESCRIPTIONS[section.title] && (
        <p className={styles.sectionDescription}>{SECTION_DESCRIPTIONS[section.title]}</p>
      )}
    </div>
    <MasonryGrid>
      {section.groups.map(group => (
        <GroupView key={group.root.class} group={group} />
      ))}
    </MasonryGrid>
  </div>
);

// ─── Panel ────────────────────────────────────────────────────────────────────

interface PhenotypeReferencePanelProps {
  onExamplesActivate: (className: string | null) => void;
}

export const PhenotypeReferencePanel: React.FC<PhenotypeReferencePanelProps> = ({ onExamplesActivate }) => {
  const [activeClass, setActiveClass] = useState<string | null>(null);

  const handleActivate = useCallback((className: string | null) => {
    setActiveClass(className);
    onExamplesActivate(className);
  }, [onExamplesActivate]);

  return (
  <ActiveClassCtx.Provider value={activeClass}>
  <OnExamplesActivateCtx.Provider value={handleActivate}>
    <div className={styles.referencePanel}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>The PhenEx Phenotypes</h1>
        <p className={styles.pageSubtitle}>
          The term computable phenotype, or simply Phenotype (capitalized), is used in PhenEx to define a filtering
          operation that identifies patients presenting with a clinical feature of interest (a conceptual definition).
          Thus, each computable Phenotype is a templated database query used to implement operational definitions.
          Each Phenotype exposes different parameters that can be used to tailor the implementation to the clinical
          content of an observational study definition.
        </p>
      </div>
      {SECTIONS.map(section => (
        <SectionView key={section.title} section={section} />
      ))}
    </div>
  </OnExamplesActivateCtx.Provider>
  </ActiveClassCtx.Provider>
  );
};
