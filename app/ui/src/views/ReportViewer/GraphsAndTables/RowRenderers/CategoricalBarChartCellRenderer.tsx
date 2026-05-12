import { FC, useMemo } from 'react';
import { type CohortClassified } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import styles from './CategoricalBarChartCellRenderer.module.css';

type Orientation = 'horizontal' | 'vertical';

interface CategoricalBarChartCellRendererProps {
  baseName: string;
  cohortData: CohortClassified[];
  orientation?: Orientation;
  breadcrumbs?: string[];
}

interface CategoryData {
  category: string;
  values: { pct: number; n: number; color: string; cohortIndex: number }[];
}

export const CategoricalBarChartCellRenderer: FC<CategoricalBarChartCellRendererProps> = ({
  baseName,
  cohortData,
  orientation = 'horizontal',
}) => {
  const { activeIndex } = useBarHoverStore();

  const categories = useMemo<CategoryData[]>(() => {
    const catSet = new Set<string>();
    const catOrder: string[] = [];
    for (const cd of cohortData) {
      const items = cd.classified.categoricals[baseName];
      if (items) {
        for (const item of items) {
          if (!catSet.has(item.category)) {
            catSet.add(item.category);
            catOrder.push(item.category);
          }
        }
      }
    }

    return catOrder.map((cat) => ({
      category: cat,
      values: cohortData.map((cd, ci) => {
        const item = cd.classified.categoricals[baseName]?.find((c) => c.category === cat);
        return { pct: item?.Pct ?? 0, n: item?.N ?? 0, color: cd.color, cohortIndex: ci };
      }),
    }));
  }, [baseName, cohortData]);

  if (categories.length === 0) return null;

  if (orientation === 'vertical') {
    return <VerticalChart categories={categories} activeIndex={activeIndex} />;
  }
  return <HorizontalChart categories={categories} activeIndex={activeIndex} />;
};

/* ── Horizontal (current style, grouped by category) ────────────────── */

const HorizontalChart: FC<{
  categories: CategoryData[];
  activeIndex: number | null;
}> = ({ categories, activeIndex }) => (
  <div className={styles.horizontal}>
    {categories.map(({ category, values }) => (
      <div key={category} className={styles.hGroup}>
        <div className={styles.hLabel}>{category}</div>
        <div className={styles.hBars}>
          {values.map(({ pct, n, color, cohortIndex }) => {
            const dimmed = activeIndex !== null && activeIndex !== cohortIndex;
            return (
              <div key={cohortIndex} className={styles.hBarRow} style={{ opacity: dimmed ? 0.25 : 1 }}>
                <div className={styles.hPct}>{Math.round(pct)}</div>
                <div className={styles.hTrack}>
                  <div className={styles.hFill} style={{ width: `${Math.max(0, pct)}%`, backgroundColor: color }} />
                </div>
                <div className={styles.hN}>{n.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

/* ── Vertical ───────────────────────────────────────────────────────── */

const VerticalChart: FC<{
  categories: CategoryData[];
  activeIndex: number | null;
}> = ({ categories, activeIndex }) => {
  const ceiling = 100;
  const ticks = [0, 20, 40, 60, 80, 100];

  return (
    <div className={styles.vertical}>
      {/* Y-axis ticks */}
      <div className={styles.vYAxis}>
        {ticks.map((t) => (
          <div key={t} className={styles.vYTick} style={{ bottom: `${(t / ceiling) * 100}%` }}>
            {t}
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className={styles.vChartArea}>
        {/* Grid lines */}
        {ticks.map((t) => (
          <div key={t} className={styles.vGridLine} style={{ bottom: `${(t / ceiling) * 100}%` }} />
        ))}

        {/* Category groups */}
        <div className={styles.vGroups}>
          {categories.map(({ category, values }) => (
            <div key={category} className={styles.vGroup}>
              {values.map(({ pct, color, cohortIndex }) => {
                const dimmed = activeIndex !== null && activeIndex !== cohortIndex;
                return (
                  <div
                    key={cohortIndex}
                    className={styles.vBar}
                    style={{
                      height: `${(pct / ceiling) * 100}%`,
                      backgroundColor: color,
                      opacity: dimmed ? 0.25 : 1,
                    }}
                  />
                );
              })}
              <div className={styles.vLabel}>{category}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
