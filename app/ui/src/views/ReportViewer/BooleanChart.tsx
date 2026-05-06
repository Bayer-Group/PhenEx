import { FC } from 'react';
import { type CohortClassified } from './types';
import { groupBySection } from './types';
import { BarChartCellRenderer } from './CellRenderers/BarChartCellRenderer';
import styles from './BooleanChart.module.css';
import sectionStyles from './ReportViewer.module.css';

/* ── Fake AI analysis data ───────────────────────────────────────────── */
const FAKE_ANALYSES: Record<string, string> = {};
const DEFAULT_ANALYSES = [
  'This is to be expected because prior diagnosis of menopause was part of the cohort definition. An outlier is the age cohort 60-65.',
  'Prevalence is consistent across subcohorts, suggesting this characteristic is independent of the stratification variable.',
  'Higher than expected rate in the baseline cohort — may reflect referral bias in the source population.',
  'The difference between cohorts is not clinically meaningful despite statistical significance (p<0.05).',
  'Consider that this phenotype overlaps with the exclusion criteria, which may explain the low prevalence.',
  'Distribution matches published literature for this population. No further investigation needed.',
  'Notably absent in the youngest age stratum. This warrants manual chart review to rule out coding artifacts.',
  'The 12% gap between cohort1 and cohort2 likely reflects differences in follow-up duration rather than true prevalence.',
];

function getAnalysis(name: string, index: number): string {
  return FAKE_ANALYSES[name] || DEFAULT_ANALYSES[index % DEFAULT_ANALYSES.length];
}

/* ── Components ──────────────────────────────────────────────────────── */

interface BooleanChartProps {
  cohortData: CohortClassified[];
  sections: Record<string, string[]> | null;
}

export const BooleanChart: FC<BooleanChartProps> = ({ cohortData, sections }) => {
  const allNames: string[] = [];
  const nameSet = new Set<string>();
  for (const cd of cohortData) {
    for (const row of cd.classified.booleans) {
      if (!nameSet.has(row.Name)) {
        nameSet.add(row.Name);
        allNames.push(row.Name);
      }
    }
  }

  if (!allNames.length) return null;

  const groups = groupBySection(allNames, sections);

  return (
    <div className={styles.mainContent}>
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.section && <h3 className={sectionStyles.sectionHeader}>{g.section}</h3>}
          <BooleanBarGroup names={g.items} cohortData={cohortData} startIndex={gi * 100} />
        </div>
      ))}
    </div>
  );
};

interface BooleanBarGroupProps {
  names: string[];
  cohortData: CohortClassified[];
  startIndex: number;
}

const BAR_ROW_H = 16;
const ROW_PADDING_TOP = 20;
const ROW_PADDING_BOTTOM = 20;

const BooleanBarGroup: FC<BooleanBarGroupProps> = ({ names, cohortData, startIndex }) => {
  const rowHeight = cohortData.length * BAR_ROW_H + ROW_PADDING_TOP + ROW_PADDING_BOTTOM;

  return (
    <div className={styles.table}>
      {names.map((name, i) => (
        <div key={name} className={styles.row} style={{ height: rowHeight }}>
          <div className={styles.nameCell}>{name}</div>
          <div className={styles.chartCell}>
            <BarChartCellRenderer data={{ name, _meta: { cohortData } }} />
          </div>
          <div className={styles.analysisCell}>
            <p className={styles.analysisText}>{getAnalysis(name, startIndex + i)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
