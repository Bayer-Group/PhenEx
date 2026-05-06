import { FC, useMemo } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { themeQuartz } from 'ag-grid-community';
import { type CohortClassified } from './types';
import { groupBySection } from './types';
import { BarChartCellRenderer } from './CellRenderers/BarChartCellRenderer';
import { NameCellRenderer } from './CellRenderers/NameCellRenderer';
import { AnalysisCellRenderer } from './CellRenderers/AnalysisCellRenderer';
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

/* ── Cell renderers ──────────────────────────────────────────────────── */

/* ── AG Grid theme ───────────────────────────────────────────────────── */
const gridTheme = themeQuartz.withParams({
  accentColor: 'transparent',
  borderColor: 'var(--line-color, #e0e0e0)',
  browserColorScheme: 'light',
  columnBorder: false,
  headerFontSize: 10,
  headerRowBorder: false,
  cellHorizontalPadding: 0,
  headerBackgroundColor: 'transparent',
  rowBorder: true,
  spacing: 0,
  wrapperBorder: false,
  backgroundColor: 'transparent',
  wrapperBorderRadius: 0,
  rowHoverColor: 'rgba(211, 213, 215, 0.04)',
});

/* ── Column definitions ──────────────────────────────────────────────── */
const columnDefs: any[] = [
  {
    field: 'name',
    headerName: '',
    width: 300,
    resizable: false,
    sortable: false,
    cellRenderer: NameCellRenderer,
    suppressHeaderMenuButton: true,
  },
  {
    field: 'chart',
    headerName: '',
    width: 300,
    resizable: false,
    sortable: false,
    cellRenderer: BarChartCellRenderer,
    suppressHeaderMenuButton: true,
  },
  {
    field: 'analysis',
    headerName: '',
    flex: 1,
    resizable: false,
    sortable: false,
    cellRenderer: AnalysisCellRenderer,
    suppressHeaderMenuButton: true,
  },
];

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
    <div>
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.section && <h3 className={sectionStyles.sectionHeader}>{g.section}</h3>}
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
  const nc = cohortData.length;
  const barRowH = 16; // BAR_H + determines  ##HEIGHT_TABLE1_ROW_BOOLEAN_TOTAL
  const rowPaddingTop = 20;
  const rowPaddingBottom = 20;

  const rowData = useMemo(
    () =>
      names.map((name, i) => ({
        name,
        chart: name,
        analysis: getAnalysis(name, i),
        _meta: { cohortData },
      })),
    [names, cohortData],
  );

  const getRowHeight = () => nc * barRowH + rowPaddingTop + rowPaddingBottom;
  const gridH = names.length * getRowHeight() + 2; // +4 for border

  return (
    <div className={styles.gridContainer} style={{ height: gridH }}>
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        theme={gridTheme}
        headerHeight={0}
        domLayout="normal"
        suppressRowHoverHighlight={false}
        getRowHeight={getRowHeight}
        defaultColDef={{
          filter: false,
          suppressHeaderMenuButton: true,
        }}
      />
    </div>
  );
};
