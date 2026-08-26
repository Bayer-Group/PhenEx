import React, { createContext, useCallback, useContext, useRef, useLayoutEffect, useEffect, useState } from 'react';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import ReactMarkdown from 'react-markdown';
import classDefinitionsRaw from '/assets/class_definitions.json?raw';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import phenotypeExamplesRaw from '/assets/phenotype_examples.json?raw';
import styles from './PhenotypeReferencePanel.module.css';
import { PhenExNavBarMenu } from '../../components/PhenExNavBar/PhenExNavBarMenu';
import birdIcon from '../../assets/bird_icon.png';

const classDefinitions: Record<string, any[]> = JSON.parse(classDefinitionsRaw);
const parametersInfo: Record<string, any> = JSON.parse(parametersInfoRaw);
const phenotypeExamples: Record<string, string[]> = JSON.parse(phenotypeExamplesRaw);

const phenotypeDescriptions: Record<string, string> = {
  EventPhenotype: 'For working with events that occur on a specific date. This provides the base functionality for Codelist and Measurement Phenotype.',
  CodelistPhenotype: 'Most commonly used Phenotype. For working with medical codelists (ICD diagnoses, NDC drugs, CPT procedures, etc.).',
  MeasurementPhenotype: 'For working with numerical values such as height, weight, vital signs, or lab test results.',
  CategoricalPhenotype: 'For working with categorical values such as sex, ethnicity, or hospitalization type.',
  AgePhenotype: 'For working with birth date data, calculating age at a specific point in time.',
  DeathPhenotype: 'For working with date of death data, calculating number of days until death from a specific point in time.',
  LogicPhenotype: 'For combining multiple phenotypes using logical operators (AND, OR, NOT) to build arbitrarily complex phenotypes.',
  ArithmeticPhenotype: 'For calculating a numerical value from other numerical phenotypes (e.g., BMI from height and weight).',
  ScorePhenotype: 'For computing medical scores such as CHA2DS2-VASc by combining phenotypes with addition, subtraction, or multiplication.',
  BinPhenotype: 'For converting numerically valued phenotypes into categorical bins, for example taking age and binning it into decades.',
  EventCountPhenotype: 'For working with multiple events; count the number of events, or the number of days between events.',
  MeasurementChangePhenotype: 'For identifying a change in a numerical measurement value between two time points.',
  WithinSameEncounterPhenotype: 'For identifying events that co-occur within the same clinical encounter.',
  TimeRangePhenotype: 'For working with a single time range containing an event of interest.',
  TimeRangeCountPhenotype: 'For counting the number of qualifying time ranges, for example the number of insurance coverage windows or drug exposure periods.',
  TimeRangeDayCountPhenotype: 'For counting the total number of days within qualifying time periods, for example the total number of days of insurance coverage or drug exposure.',
  TimeRangeDaysToNextRange: 'For counting the number of days until the next observation period begins.',
  FurtherValueFilterPhenotype: 'For applying further value filtering to an existing numerically valued phenotype.',
  UserDefinedPhenotype: 'For incorporating manually written custom user-defined functions, allowing hybrid analyses using PhenEx components and custom coded study elements.',
};

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
  'Atomic': 'These act predominantly on a single data source table, filtering them for a specific event or patient characteristic.',
  'Composite': 'These allow us to combine multiple other phenotypes and allow us to build arbitrarily complex medical definitions using logical and arithmetic operators.',
  'Extension': 'These augment existing phenotypes with additional filtering or counting logic.',
  'Time Range': 'These are for working with time ranges with a start and end date, such as insurance coverage windows or drug exposure periods.',
  'User Defined': 'These allow us to build hybrid analyses that integrate custom code into templated analyses.',
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
    title: 'Extension',
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
const RegisterCardRefCtx = createContext<(className: string, el: HTMLElement | null) => void>(() => {});

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
  const registerCardRef = useContext(RegisterCardRefCtx);
  const cardDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phenotypeName) {
      registerCardRef(phenotypeName, cardDivRef.current);
      return () => { registerCardRef(phenotypeName, null); };
    }
  }, [phenotypeName, registerCardRef]);
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
    onClick: () => onExamplesActivate(phenotypeName),
    onMouseLeave: () => onExamplesActivate(null),
  } : {};

  return (
    <div ref={cardDivRef} className={`${styles.card} ${dimmed ? styles.cardDimmed : ''}`} {...cardHoverProps}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          {title}
          {tag && <span style={{ opacity: 0.3, marginLeft: '6px', fontFamily: 'IBMPlexSans-regular' }}>{tag}</span>}
        </h3>
        {description && <p className={styles.cardDescription}>{description}</p>}
      </div>
      {/* <div className={styles.cardFooter}>
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
      </PhenExNavBarMenu> */}
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
    ro.observe(el); // reflow when the flexlayout panel itself resizes
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

function getSectionClasses(section: SectionDef): string[] {
  return section.groups.flatMap(g => [g.root.class, ...(g.children?.map(c => c.class) ?? [])]);
}

// ─── Section ──────────────────────────────────────────────────────────────────

const SectionView: React.FC<{ section: SectionDef }> = ({ section }) => {
  const activeClass = useContext(ActiveClassCtx);
  const headerDimmed = activeClass !== null && !getSectionClasses(section).includes(activeClass);
  return (
  <div className={styles.section}>
    <div className={`${styles.sectionHeader} ${headerDimmed ? styles.sectionHeaderDimmed : ''}`}>
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
};

// ─── Panel ────────────────────────────────────────────────────────────────────

interface PhenotypeReferencePanelProps {
  onExamplesActivate: (className: string | null) => void;
  onRegisterScroll?: (fn: (className: string | null) => void) => void;
}

export const PhenotypeReferencePanel: React.FC<PhenotypeReferencePanelProps> = ({ onExamplesActivate, onRegisterScroll }) => {
  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [titleVisible, setTitleVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelWrapperRef = useRef<HTMLDivElement>(null);
  const pageTitleRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const registerCardRef = useCallback((className: string, el: HTMLElement | null) => {
    cardRefs.current[className] = el;
  }, []);

  useEffect(() => {
    const el = pageTitleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTitleVisible(entry.isIntersecting),
      { root: scrollRef.current, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onRegisterScroll?.((className) => {
      if (className !== null) {
        setActiveClass(className);
        cardRefs.current[className]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setActiveClass(null);
      }
    });
  }, [onRegisterScroll]);

  const handleActivate = useCallback((className: string | null) => {
    setActiveClass(className);
    onExamplesActivate(className);
  }, [onExamplesActivate]);

  return (
  <ActiveClassCtx.Provider value={activeClass}>
  <OnExamplesActivateCtx.Provider value={handleActivate}>
  <RegisterCardRefCtx.Provider value={registerCardRef}>
    <div ref={panelWrapperRef} className={styles.panelWrapper}>
      <div className={`${styles.stickyHeader} ${!titleVisible ? styles.stickyHeaderVisible : ''}`}>
        <img src={birdIcon} className={styles.stickyBird} alt="" />
        <span className={styles.stickyTitle}>Phenotypes</span>
      </div>
    <div ref={scrollRef} className={styles.referencePanel}>
      <div className={styles.pageHeader}>
        <div ref={pageTitleRef} className={styles.pageTitle}><img src={birdIcon} className={styles.pageTitleBird} alt="" />Phenotypes</div>
        <p className={styles.pageSubtitle}>
          The computable phenotypes, or simply Phenotypes (capitalized), are templated database
          queries that identify patients or events with clinical significance in real world data sources. They expose parameters that you must define to implement observational studies. Each study element (e.g. cohort eligibility criteria, baseline characteristics, and outcomes) can be defined using one or more Phenotypes. Listed here are all the different Phenotypes. Click on a Phenotype to see examples of how it can be used.
        </p>
      </div>
      {SECTIONS.map(section => (
        <SectionView key={section.title} section={section} />
      ))}
    </div>
    <div className={styles.scrollbarRegion}>
      <SimpleCustomScrollbar
        targetRef={scrollRef}
        hoverTargetRef={panelWrapperRef}
        orientation="vertical"
        marginTop={10}
        marginBottom={10}
        marginToEnd={0}
        classNameTrack={styles.scrollBarTrack}
        classNameThumb={styles.scrollBarThumb}
        showOnHover={true}
      />
    </div>
    </div>
  </RegisterCardRefCtx.Provider>
  </OnExamplesActivateCtx.Provider>
  </ActiveClassCtx.Provider>
  );
};
