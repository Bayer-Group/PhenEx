import React, { useRef, useLayoutEffect, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import classDefinitionsRaw from '/assets/class_definitions.json?raw';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import phenotypeDescriptionsRaw from '/assets/phenotype_descriptions.json?raw';
import phenotypeExamplesRaw from '/assets/phenotype_examples.json?raw';
import styles from './DocViewer.module.css';

const classDefinitions: Record<string, any[]> = JSON.parse(classDefinitionsRaw);
const parametersInfo: Record<string, any> = JSON.parse(parametersInfoRaw);
const phenotypeDescriptions: Record<string, string> = JSON.parse(phenotypeDescriptionsRaw);
const phenotypeExamples: Record<string, string[]> = JSON.parse(phenotypeExamplesRaw);

// ─── Section / group structure ───────────────────────────────────────────────

type EntryDef = {
  class: string;
  /** Params belonging to these ancestor classes will be hidden on this card. */
  excludeClasses?: string[];
};

type GroupDef = {
  root: EntryDef;
  children?: EntryDef[];
};

type SectionDef = {
  title: string;
  groups: GroupDef[];
};

const SECTIONS: SectionDef[] = [
  {
    title: 'Atomic',
    groups: [
      {
        root: { class: 'EventPhenotype' },
        children: [
          { class: 'CodelistPhenotype', excludeClasses: ['EventPhenotype'] },
          {
            class: 'MeasurementPhenotype',
            excludeClasses: ['EventPhenotype', 'CodelistPhenotype'],
          },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatParamName(param: string): string {
  return param.split('_').join(' ');
}

/** Splits e.g. "CodelistPhenotype" → { title: "Codelist", tag: "Phenotype" } */
function parseClassName(name: string): { title: string; tag: string } {
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

// ─── Accordion section ──────────────────────────────────────────────────────────

const AccordionSection: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({
  title,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.accordionSection}>
      <button className={styles.accordionHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.accordionTitle}>{title}</span>
        <span className={`${styles.accordionChevron} ${open ? styles.accordionChevronOpen : ''}`}>&#9654;</span>
      </button>
      {open && <div className={styles.accordionBody}>{children}</div>}
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
  examples?: string[];
}

const ClassCard: React.FC<ClassCardProps> = ({ title, tag, description, extendsLabel, params, examples }) => (
  <div className={styles.card}>
    {tag && <span className={styles.classTab}>{tag}</span>}
    <div className={styles.cardHeader}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {extendsLabel && <span className={styles.extendsBadge}>extends {extendsLabel}</span>}
      {description && <span className={styles.cardDescription}>{description}</span>}
    </div>
    <AccordionSection title="Parameters">
      {params.length === 0 ? (
        <div className={styles.noParams}>No additional parameters</div>
      ) : (
        <div className={styles.paramList}>
          {params.map((p: any) => <ParamRow key={p.param} param={p} />)}
        </div>
      )}
    </AccordionSection>
    {examples && examples.length > 0 && (
      <AccordionSection title="Examples" defaultOpen={false}>
        <ul className={styles.exampleList}>
          {examples.map((ex, i) => (
            <li key={i} className={styles.exampleItem}>
              <ReactMarkdown>{ex}</ReactMarkdown>
            </li>
          ))}
        </ul>
      </AccordionSection>
    )}
  </div>
);

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
      examples={phenotypeExamples[entry.class]}
    />
  );
};

// ─── MasonryGrid ─────────────────────────────────────────────────────────────

const GAP = 40;
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
    <h2 className={styles.sectionTitle}>{section.title}</h2>
    <MasonryGrid>
      {section.groups.map(group => (
        <GroupView key={group.root.class} group={group} />
      ))}
    </MasonryGrid>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const DocViewer: React.FC = () => (
  <div className={styles.page}>
    <div className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>Phenotype Reference</h1>
      <p className={styles.pageSubtitle}>All available phenotype classes and their parameters</p>
    </div>
    {SECTIONS.map(section => (
      <SectionView key={section.title} section={section} />
    ))}
  </div>
);
