import { FC, useRef, useEffect, useState, useCallback } from 'react';
import { type CohortClassified, type Table1Row } from './types';
import { groupBySection } from './types';
import { fetchDistributions } from './ReportViewerDataService';
import styles from './ReportViewer.module.css';

interface NumericChartProps {
  cohortData: CohortClassified[];
  sections: Record<string, string[]> | null;
  runId: string;
  selectedCohorts: Set<string>;
}

export const NumericChart: FC<NumericChartProps> = ({
  cohortData,
  sections,
  runId,
  selectedCohorts,
}) => {
  const allNames: string[] = [];
  const nameSet = new Set<string>();
  for (const cd of cohortData) {
    for (const row of cd.classified.numerics) {
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
          {g.items.map((name) => (
            <NumericSingle
              key={name}
              phenoName={name}
              cohortData={cohortData}
              runId={runId}
              selectedCohorts={selectedCohorts}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface NumericSingleProps {
  phenoName: string;
  cohortData: CohortClassified[];
  runId: string;
  selectedCohorts: Set<string>;
}

const NumericSingle: FC<NumericSingleProps> = ({
  phenoName,
  cohortData,
  runId,
  selectedCohorts,
}) => {
  const [distributions, setDistributions] = useState<
    Record<string, number[]> | null
  >(null);
  const [loading, setLoading] = useState(false);

  const loadDistributions = useCallback(async () => {
    setLoading(true);
    const allDists: Record<string, number[]> = {};
    const selected = Array.from(selectedCohorts);
    await Promise.all(
      selected.map(async (cohortName) => {
        try {
          const dist = await fetchDistributions(runId, cohortName, phenoName);
          if (dist[phenoName]) {
            allDists[cohortName] = dist[phenoName];
          }
        } catch {
          // No distribution available for this cohort
        }
      }),
    );
    setDistributions(Object.keys(allDists).length ? allDists : null);
    setLoading(false);
  }, [runId, phenoName, selectedCohorts]);

  if (distributions !== null) {
    return (
      <HistogramChart
        phenoName={phenoName}
        cohortData={cohortData}
        distributions={distributions}
      />
    );
  }

  if (loading) {
    return (
      <div className={styles.chartSection}>
        <h2 className={styles.chartTitle}>{phenoName} (loading...)</h2>
      </div>
    );
  }

  return (
    <SummaryStatsTable
      phenoName={phenoName}
      cohortData={cohortData}
      onLoadDistributions={loadDistributions}
    />
  );
};

// ── Histogram ───────────────────────────────────────────────────────────

interface HistogramChartProps {
  phenoName: string;
  cohortData: CohortClassified[];
  distributions: Record<string, number[]>;
}

const NUM_BINS = 20;

const HistogramChart: FC<HistogramChartProps> = ({
  phenoName,
  cohortData,
  distributions,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const padL = 50, padR = 20, padT = 20, padB = 40;
  const plotH = 180, plotW = 500;
  const W = padL + plotW + padR;
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

    // Compute global min/max
    let gMin = Infinity, gMax = -Infinity;
    for (const vals of Object.values(distributions)) {
      for (const v of vals) {
        if (v < gMin) gMin = v;
        if (v > gMax) gMax = v;
      }
    }
    if (gMin === gMax) { gMin -= 0.5; gMax += 0.5; }
    const bw = (gMax - gMin) / NUM_BINS;

    // Bin all series
    let maxPct = 0;
    const allBinned: { color: string; bins: { pct: number }[] }[] = [];

    for (const cd of cohortData) {
      const vals = distributions[cd.name];
      if (!vals) continue;
      const bins = Array.from({ length: NUM_BINS }, (_, i) => ({
        x0: gMin + i * bw,
        x1: gMin + (i + 1) * bw,
        count: 0,
        pct: 0,
      }));
      for (const v of vals) {
        const idx = Math.min(Math.floor((v - gMin) / bw), NUM_BINS - 1);
        bins[idx].count++;
      }
      const total = vals.length;
      for (const b of bins) {
        b.pct = total > 0 ? (b.count / total) * 100 : 0;
        if (b.pct > maxPct) maxPct = b.pct;
      }
      allBinned.push({ color: cd.color, bins });
    }

    let yMax = Math.ceil(maxPct / 5) * 5;
    if (yMax < 1) yMax = 1;
    const sx = (v: number) => padL + ((v - gMin) / (gMax - gMin)) * plotW;
    const sy = (v: number) => padT + plotH - (v / yMax) * plotH;

    // Grid
    for (let ti = 0; ti <= 4; ti++) {
      const v = (yMax / 4) * ti;
      mkEl('line', { x1: padL, y1: sy(v), x2: padL + plotW, y2: sy(v), stroke: '#eee' });
      mkText(`${Math.round(v)}%`, {
        x: padL - 6, y: sy(v) + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#999',
      });
    }

    // Bars
    const barW = plotW / NUM_BINS;
    for (const s of allBinned) {
      const color = s.color;
      for (let bi = 0; bi < s.bins.length; bi++) {
        const bh = Math.max(0, (s.bins[bi].pct / yMax) * plotH);
        mkEl('rect', {
          x: padL + bi * barW + 1,
          y: padT + plotH - bh,
          width: Math.max(barW - 2, 1),
          height: bh,
          fill: color,
          'fill-opacity': 0.5,
          stroke: color,
          'stroke-width': 0.5,
        });
      }
    }

    // X labels
    const nLabels = 5;
    for (let i = 0; i <= nLabels; i++) {
      const v = gMin + ((gMax - gMin) / nLabels) * i;
      const label = v % 1 === 0 ? v.toString() : v.toFixed(1);
      mkText(label, {
        x: sx(v), y: padT + plotH + 16,
        'text-anchor': 'middle', 'font-size': 10, fill: '#666',
      });
    }
  }, [cohortData, distributions]);

  return (
    <div className={styles.chartSection}>
      <h2 className={styles.chartTitle}>{phenoName} (distribution)</h2>
      <svg ref={svgRef} width={W} height={H} style={{ display: 'block' }} />
    </div>
  );
};

// ── Summary stats fallback ──────────────────────────────────────────────

interface SummaryStatsTableProps {
  phenoName: string;
  cohortData: CohortClassified[];
  onLoadDistributions: () => void;
}

const STATS = ['N', 'Mean', 'STD', 'Min', 'P25', 'Median', 'P75', 'Max'] as const;

const SummaryStatsTable: FC<SummaryStatsTableProps> = ({
  phenoName,
  cohortData,
  onLoadDistributions,
}) => {
  const rows: { name: string; color: string; row: Table1Row }[] = [];
  for (const cd of cohortData) {
    for (const r of cd.classified.numerics) {
      if (r.Name === phenoName) {
        rows.push({ name: cd.name, color: cd.color, row: r });
      }
    }
  }
  if (!rows.length) return null;

  const formatVal = (v: number | null | undefined) => {
    if (v == null || isNaN(v)) return '';
    return typeof v === 'number' && v % 1 !== 0 ? v.toFixed(1) : String(v);
  };

  return (
    <div className={styles.chartSection}>
      <h2 className={styles.chartTitle}>
        {phenoName} (summary)
        <button className={styles.loadDistBtn} onClick={onLoadDistributions}>
          Load distribution
        </button>
      </h2>
      <table className={styles.summaryTable}>
        <thead>
          <tr>
            <th />
            {STATS.map((s) => (
              <th key={s}>{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ color: r.color, fontWeight: 'bold' }}>
                {r.name}
              </td>
              {STATS.map((s) => (
                <td key={s}>{formatVal(r.row[s] as number | null | undefined)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
