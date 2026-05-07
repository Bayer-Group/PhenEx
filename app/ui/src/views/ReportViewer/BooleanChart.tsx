import { FC } from 'react';
import { type CohortClassified, type SectionGroup } from './types';
import { groupBySection } from './types';
import { BarChartCellRenderer } from './CellRenderers/BarChartCellRenderer';
import styles from './BooleanChart.module.css';
import sectionStyles from './ReportViewer.module.css';

/* ── Layout constants ────────────────────────────────────────────────── */

const MAX_ROWS = 10;
const BAR_ROW_H = 16;
const ROW_PADDING_TOP = 20;
const ROW_PADDING_BOTTOM = 20;

/* ── Layout helpers ──────────────────────────────────────────────────── */

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * A placement block is either:
 *  - A vertical stack of single-column sections, or
 *  - A single multi-column section.
 * Blocks are rendered side by side horizontally.
 */
interface PlacementBlock {
  sections: SectionGroup[];
  cols: number;
}

function buildLayout(groups: SectionGroup[]): PlacementBlock[] {
  const blocks: PlacementBlock[] = [];
  let shortStack: SectionGroup[] = [];

  const flush = () => {
    if (shortStack.length) {
      blocks.push({ sections: [...shortStack], cols: 1 });
      shortStack = [];
    }
  };

  for (const g of groups) {
    const cols = Math.ceil(g.items.length / MAX_ROWS);
    if (cols <= 1) {
      shortStack.push(g);
    } else {
      flush();
      blocks.push({ sections: [g], cols });
    }
  }
  flush();
  return blocks;
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
  const blocks = buildLayout(groups);

  return (
    <div className={styles.blocksContainer}>
      {blocks.map((block, bi) => (
        <div key={bi} className={styles.block}>
          {block.sections.map((g, gi) => (
            <div key={gi} className={styles.section}>
              {g.section && <h3 className={sectionStyles.sectionHeader}>{g.section}</h3>}
              <SectionColumns names={g.items} cohortData={cohortData} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

/* ── Section with column wrapping ────────────────────────────────────── */

interface SectionColumnsProps {
  names: string[];
  cohortData: CohortClassified[];
}

const SectionColumns: FC<SectionColumnsProps> = ({ names, cohortData }) => {
  const rowHeight = cohortData.length * BAR_ROW_H + ROW_PADDING_TOP + ROW_PADDING_BOTTOM;
  const columns = chunk(names, MAX_ROWS);

  return (
    <div className={styles.sectionColumns}>
      {columns.map((colItems, ci) => (
        <div key={ci} className={styles.column}>
          {colItems.map((name) => (
            <div key={name} className={styles.row} style={{ height: rowHeight }}>
              <div className={styles.nameCell}>{name}</div>
              <div className={styles.chartCell}>
                <BarChartCellRenderer data={{ name, _meta: { cohortData } }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
