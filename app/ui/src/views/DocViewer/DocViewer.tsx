import React from 'react';
import ReactMarkdown from 'react-markdown';
import classDefinitionsRaw from '/assets/class_definitions.json?raw';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import phenotypeDescriptionsRaw from '/assets/phenotype_descriptions.json?raw';
import styles from './DocViewer.module.css';

const classDefinitions: Record<string, any[]> = JSON.parse(classDefinitionsRaw);
const parametersInfo: Record<string, any> = JSON.parse(parametersInfoRaw);
const phenotypeDescriptions: Record<string, string> = JSON.parse(phenotypeDescriptionsRaw);

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

// ─── Phenotype card ───────────────────────────────────────────────────────────

interface PhenotypeCardProps {
  entry: EntryDef;
  extendsClass?: string;
}

const PhenotypeCard: React.FC<PhenotypeCardProps> = ({ entry, extendsClass }) => {
  const params = getVisibleParams(entry.class, entry.excludeClasses);
  const description = phenotypeDescriptions[entry.class] ?? '';

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{entry.class}</h3>
        {extendsClass && (
          <span className={styles.extendsBadge}>extends {extendsClass}</span>
        )}
        {description && <p className={styles.cardDescription}>{description}</p>}
      </div>
      <div className={styles.paramList}>
        {params.length === 0 ? (
          <div className={styles.noParams}>No additional parameters</div>
        ) : (
          params.map((p: any) => <ParamRow key={p.param} param={p} />)
        )}
      </div>
    </div>
  );
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
    <div className={styles.sectionColumns}>
      {section.groups.map(group => (
        <GroupView key={group.root.class} group={group} />
      ))}
    </div>
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
