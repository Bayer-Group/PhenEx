import React from 'react';
import classDefinitionsRaw from '/assets/class_definitions.json?raw';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import styles from './DocViewer.module.css';

const classDefinitions: Record<string, any[]> = JSON.parse(classDefinitionsRaw);
const parametersInfo: Record<string, any> = JSON.parse(parametersInfoRaw);

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
      { root: { class: 'WithinSameEncounterPhenotype' } },
    ],
  },
  {
    title: 'Time Range',
    groups: [
      {
        root: { class: 'TimeRangePhenotype' },
        children: [
          { class: 'TimeRangeCountPhenotype', excludeClasses: ['TimeRangePhenotype'] },
          { class: 'TimeRangeDayCountPhenotype', excludeClasses: ['TimeRangePhenotype'] },
          { class: 'TimeRangeDaysToNextRange', excludeClasses: ['TimeRangePhenotype'] },
        ],
      },
      { root: { class: 'FurtherValueFilterPhenotype' } },
    ],
  },
  {
    title: 'User Defined',
    groups: [{ root: { class: 'UserDefinedPhenotype' } }],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatClassName(name: string): string {
  const withoutSuffix = name.endsWith('Phenotype') ? name.slice(0, -9) : name;
  return withoutSuffix.replace(/([A-Z])/g, ' $1').trim();
}

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
      <div className={styles.paramLeft}>
        <span className={`${styles.paramName} ${param.required ? styles.required : ''}`}>
          {formatParamName(param.display_name ?? param.param)}
        </span>
        <span className={styles.paramType}>{param.type}</span>
        {param.default !== null && param.default !== undefined && (
          <span className={styles.paramDefault}>default: {String(param.default)}</span>
        )}
      </div>
      {description && <div className={styles.paramDescription}>{description}</div>}
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

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{formatClassName(entry.class)}</h3>
        {extendsClass && (
          <span className={styles.extendsBadge}>extends {formatClassName(extendsClass)}</span>
        )}
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

  if (!children || children.length === 0) {
    return (
      <div className={styles.group}>
        <PhenotypeCard entry={root} />
      </div>
    );
  }

  return (
    <div className={styles.group}>
      <PhenotypeCard entry={root} />
      <div className={styles.childrenBox}>
        {children.map(child => {
          const immediateParent = child.excludeClasses?.[child.excludeClasses.length - 1];
          return (
            <PhenotypeCard key={child.class} entry={child} extendsClass={immediateParent} />
          );
        })}
      </div>
    </div>
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
