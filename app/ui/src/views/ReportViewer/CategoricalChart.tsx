import { FC, useRef, useEffect } from 'react';
import { COLORS, type CohortClassified } from './types';
import { groupBySection } from './types';
import styles from './ReportViewer.module.css';

interface CategoricalChartProps {
  cohortData: CohortClassified[];
  sections: Record<string, string[]> | null;
}

export const CategoricalChart: FC<CategoricalChartProps> = ({ cohortData, sections }) => {
  // Collect all phenotype names and their categories
  const allPhenos: string[] = [];
  const phenoSet = new Set<string>();
  const allCats: Record<string, string[]> = {};

  for (const cd of cohortData) {
    for (const ph of cd.classified.catOrder) {
      if (!phenoSet.has(ph)) {
        phenoSet.add(ph);
        allPhenos.push(ph);
        allCats[ph] = [];
      }
    }
    for (const [ph, items] of Object.entries(cd.classified.categoricals)) {
      if (!allCats[ph]) continue;
      for (const item of items) {
        if (!allCats[ph].includes(item.category)) {
          allCats[ph].push(item.category);
        }
      }
    }
  }

  if (!allPhenos.length) return null;

  const groups = groupBySection(allPhenos, sections);

  return (
    <div>
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.section && <h3 className={styles.sectionHeader}>{g.section}</h3>}
          {g.items.map((phenoName) => {
            const categories = allCats[phenoName] || [];
            if (!categories.length) return null;
            return (
              <CategoricalSingle
                key={phenoName}
                phenoName={phenoName}
                categories={categories}
                cohortData={cohortData}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

interface CategoricalSingleProps {
  phenoName: string;
  categories: string[];
  cohortData: CohortClassified[];
}

const CategoricalSingle: FC<CategoricalSingleProps> = ({ phenoName, categories, cohortData }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const nc = cohortData.length;
  const groupW = nc * 18 + (nc - 1) * 2;
  const catGap = 20;
  const padL = 50, padR = 20, padT = 20, padB = 60;
  const plotH = 200;
  const plotW = categories.length * (groupW + catGap) - catGap;
  const W = Math.max(padL + plotW + padR, 200);
  const H = padT + plotH + padB;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
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

    let maxPct = 0;
    for (const cd of cohortData) {
      const cats = cd.classified.categoricals[phenoName] || [];
      for (const c of cats) {
        if (c.Pct > maxPct) maxPct = c.Pct;
      }
    }
    maxPct = Math.max(maxPct, 1);
    let yMax = Math.ceil(maxPct / 10) * 10;
    if (yMax < maxPct) yMax = maxPct + 5;

    const sy = (v: number) => padT + plotH - (v / yMax) * plotH;

    // Y-axis ticks
    const nTicks = 4;
    for (let ti = 0; ti <= nTicks; ti++) {
      const v = (yMax / nTicks) * ti;
      const y = sy(v);
      mkEl('line', { x1: padL, y1: y, x2: padL + plotW, y2: y, stroke: '#eee' });
      mkText(`${Math.round(v)}%`, {
        x: padL - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#999',
      });
    }

    // Bars
    categories.forEach((cat, cati) => {
      const gx = padL + cati * (groupW + catGap);
      cohortData.forEach((cd, ci) => {
        const cats = cd.classified.categoricals[phenoName] || [];
        const item = cats.find((c) => c.category === cat);
        const pct = item?.Pct ?? 0;
        const color = COLORS[cd.ci % COLORS.length];
        const bw = 18;
        const bx = gx + ci * (bw + 2);
        const bh = Math.max(0, (pct / yMax) * plotH);
        mkEl('rect', {
          x: bx, y: padT + plotH - bh, width: bw, height: bh, fill: color, rx: 1,
        });
      });
      // X-axis label
      const labelX = gx + groupW / 2;
      const lbl = mkText(cat, {
        x: labelX, y: padT + plotH + 14,
        'text-anchor': 'middle', 'font-size': 10, fill: '#333',
      });
      if (cat.length > 12) {
        lbl.setAttribute('transform', `rotate(30,${labelX},${padT + plotH + 14})`);
        lbl.setAttribute('text-anchor', 'start');
      }
    });
  }, [phenoName, categories, cohortData, nc, groupW, plotW, W, H]);

  return (
    <div className={styles.chartSection}>
      <h2 className={styles.chartTitle}>{phenoName}</h2>
      <svg ref={svgRef} width={W} height={H} style={{ display: 'block' }} />
    </div>
  );
};
