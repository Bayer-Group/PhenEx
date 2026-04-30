import { FC, useRef, useEffect } from 'react';
import { COLORS, type CohortClassified } from './types';
import { groupBySection } from './types';
import styles from './ReportViewer.module.css';

interface BooleanChartProps {
  cohortData: CohortClassified[];
  sections: Record<string, string[]> | null;
}

const BAR_H = 16;
const BAR_GAP = 2;
const PHENO_GAP = 14;
const PAD_L = 220;
const PAD_R = 160;
const PAD_T = 24;
const PAD_B = 20;
const BAR_W = 400;

export const BooleanChart: FC<BooleanChartProps> = ({ cohortData, sections }) => {
  // Collect all boolean names across selected cohorts
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
    <div>
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.section && <h3 className={styles.sectionHeader}>{g.section}</h3>}
          <BooleanBarGroup names={g.items} cohortData={cohortData} />
        </div>
      ))}
    </div>
  );
};

interface BooleanBarGroupProps {
  names: string[];
  cohortData: CohortClassified[];
}

const BooleanBarGroup: FC<BooleanBarGroupProps> = ({ names, cohortData }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const nc = cohortData.length;
  const phenoH = nc * BAR_H + (nc - 1) * BAR_GAP;
  const W = PAD_L + BAR_W + PAD_R;
  const H = PAD_T + names.length * (phenoH + PHENO_GAP) - PHENO_GAP + PAD_B;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // Clear previous content
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const NS = 'http://www.w3.org/2000/svg';
    const mkEl = (tag: string, attrs: Record<string, string | number>) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      svg.appendChild(e);
      return e;
    };
    const mkText = (text: string, attrs: Record<string, string | number>) => {
      const e = mkEl('text', attrs);
      e.textContent = text;
      return e;
    };

    // Grid lines
    for (const p of [0, 25, 50, 75, 100]) {
      const x = PAD_L + (p / 100) * BAR_W;
      mkEl('line', { x1: x, y1: PAD_T - 4, x2: x, y2: H - PAD_B, stroke: '#eee' });
      mkText(`${p}%`, { x, y: PAD_T - 8, 'text-anchor': 'middle', 'font-size': 10, fill: '#aaa' });
    }

    names.forEach((name, ni) => {
      const y0 = PAD_T + ni * (phenoH + PHENO_GAP);
      mkText(name, {
        x: PAD_L - 8, y: y0 + phenoH / 2 + 4,
        'text-anchor': 'end', 'font-size': 12, fill: '#333',
      });

      cohortData.forEach((cd, ci) => {
        const row = cd.classified.booleans.find((r) => r.Name === name);
        const pct = row?.Pct ?? 0;
        const n = row?.N ?? 0;
        const barY = y0 + ci * (BAR_H + BAR_GAP);
        const color = COLORS[cd.ci % COLORS.length];

        mkEl('rect', {
          x: PAD_L, y: barY,
          width: Math.max(0, (pct / 100) * BAR_W), height: BAR_H,
          fill: color, rx: 2,
        });
        mkText(`${Math.round(pct * 10) / 10}% (N=${n})`, {
          x: PAD_L + Math.max((pct / 100) * BAR_W, 0) + 6,
          y: barY + BAR_H / 2 + 4,
          'font-size': 10, fill: '#666',
        });
      });
    });
  }, [names, cohortData, nc, phenoH, H]);

  return <svg ref={svgRef} width={W} height={H} style={{ display: 'block' }} />;
};
