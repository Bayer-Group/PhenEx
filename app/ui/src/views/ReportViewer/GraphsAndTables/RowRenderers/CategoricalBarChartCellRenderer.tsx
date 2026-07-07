import { FC, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified } from '../../types';
import { useBarHoverStore } from './useBarHoverStore';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import styles from './CategoricalBarChartCellRenderer.module.css';

type Orientation = 'horizontal' | 'vertical';

interface CategoricalBarChartCellRendererProps {
  baseName: string;
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  orientation?: Orientation;
  breadcrumbs?: string[];
  /** Expand to fill the available width (grid / fill-height context). */
  fillWidth?: boolean;
}

interface CategoryData {
  category: string;
  values: { pct: number; n: number; color: string; cohortIndex: number; cohortName: string; finalCohortSize: number | null }[];
}

export const CategoricalBarChartCellRenderer: FC<CategoricalBarChartCellRendererProps> = ({
  baseName,
  cohortData,
  finalCohortSizes = {},
  orientation = 'horizontal',
  fillWidth = false,
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
        return {
          pct: item?.Pct ?? 0,
          n: item?.N ?? 0,
          color: cd.color,
          cohortIndex: ci,
          cohortName: cd.name,
          finalCohortSize: finalCohortSizes[cd.name] ?? null,
        };
      }),
    }));
  }, [baseName, cohortData, finalCohortSizes]);

  if (categories.length === 0) return null;

  if (orientation === 'vertical') {
    return <VerticalChart categories={categories} activeIndex={activeIndex} fillWidth={fillWidth} />;
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

const MIN_GROUP_WIDTH_PX = 40;
const MIN_BAR_WIDTH_PX = 8;
// Must stay in sync with `.vBar { max-width }` and `.vGroup { padding }` / `.vGroup { gap }` in the CSS module.
const MAX_BAR_WIDTH_PX = 16;
const GROUP_PADDING_PX = 16; // 8px left + 8px right
const BAR_GAP_PX = 1;
// Minimum reserved height for the x-axis label row (matches `--label-row-height` default in the CSS module).
const MIN_LABEL_ROW_HEIGHT_PX = 36;

const VerticalChart: FC<{
  categories: CategoryData[];
  activeIndex: number | null;
  fillWidth?: boolean;
}> = ({ categories, activeIndex, fillWidth = false }) => {
  const ceiling = 100;
  const ticks = [0, 20, 40, 60, 80, 100];
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelRowRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  // Measured label-row height so long, wrapping x-axis labels push the plot
  // area up (rather than being clipped) while the Y-axis ticks stay aligned.
  const [labelRowHeight, setLabelRowHeight] = useState(MIN_LABEL_ROW_HEIGHT_PX);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = labelRowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setLabelRowHeight(Math.max(MIN_LABEL_ROW_HEIGHT_PX, Math.ceil(entry.contentRect.height))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cohortCount = categories[0]?.values.length ?? 1;
  const groupMinWidth = Math.max(MIN_GROUP_WIDTH_PX, cohortCount * MIN_BAR_WIDTH_PX);
  const minChartWidth = categories.length * groupMinWidth;
  // Width at which every bar reaches its max width — bars stop growing past this point.
  const groupMaxWidth = cohortCount * MAX_BAR_WIDTH_PX + (cohortCount - 1) * BAR_GAP_PX + GROUP_PADDING_PX;
  const maxChartWidth = categories.length * groupMaxWidth;
  // Fill the available width (growing bars up to their max); scroll once even the min width overflows.
  // In fill-width (grid) mode the groups expand to occupy the full parent width
  // instead of capping at the max chart width, matching the box-plot behaviour.
  const innerWidth = fillWidth
    ? Math.max(minChartWidth, availableWidth)
    : Math.min(maxChartWidth, Math.max(minChartWidth, availableWidth));

  return (
    <div className={styles.vSizer}>
    <div
      className={styles.vertical}
      style={{ ['--label-row-height' as string]: `${labelRowHeight}px` }}
    >
      <div className={styles.vChartRow}>
        {/* Fixed Y-axis, outside the scroll region. Plot height only (label row excluded). */}
        <div className={styles.vYAxis}>
          <div className={styles.vYAxisInner}>
            {ticks.map((t) => (
              <div key={t} className={styles.vYTick} style={{ bottom: `${(t / ceiling) * 100}%` }}>
                {t}%
              </div>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className={styles.vScrollArea}>
          <div
            className={styles.vScrollInner}
            style={{ width: innerWidth, ['--group-min-width' as string]: `${groupMinWidth}px` }}
          >
            <div className={styles.vChartArea}>
              {ticks.map((t) => (
                <div key={t} className={styles.vGridLine} style={{ bottom: `${(t / ceiling) * 100}%` }} />
              ))}
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
                  </div>
                ))}
              </div>
            </div>
            {/* Labels below the plot, scroll horizontally with the bars and stay aligned with groups */}
            <div ref={labelRowRef} className={styles.vLabelRow}>
              {categories.map(({ category }) => (
                <div key={category} className={styles.vLabel} title={category}>{category}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SimpleCustomScrollbar
        targetRef={scrollRef}
        orientation="horizontal"
        marginTop={0}
        marginToEnd={40}
        classNameTrack={styles.vScrollBarTrack}
        classNameThumb={styles.vScrollBarThumb}
        showOnHover={true}
      />
    </div>
    </div>
  );
};
