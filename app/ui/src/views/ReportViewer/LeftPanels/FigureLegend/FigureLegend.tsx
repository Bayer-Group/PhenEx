import { FC, useState, useCallback, useRef } from 'react';
import { LegendDot } from '../CohortSelector/LegendDot';
import { type ColorUsage } from '../CohortSelector/ColorPicker';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import {
  getSelectionColor,
  isSpacer,
  isCohortSelection,
  SPACER_SIZES,
  getCohortLabelParts,
  type LegendItem,
  type LegendSelection,
  type LegendSpacer,
  type CohortDescriptions,
  type ColorOverrides,
} from '../../types';
import { FigureLegendSets } from './FigureLegendSets';
import { useFigureLegendSets, type FigureLegendSetData } from './figureLegendSetStore';
import styles from './FigureLegend.module.css';

interface FigureLegendProps {
  items: LegendItem[];
  onChange: (items: LegendItem[]) => void;
  cohortDescriptions?: CohortDescriptions;
  colorOverrides?: ColorOverrides;
  onSetColor?: (cohortName: string, color: string) => void;
  /** Bulk-replace all color overrides (used when applying a saved legend set). */
  onReplaceColorOverrides?: (overrides: ColorOverrides) => void;
  /** Run this legend belongs to; enables saved legend sets when provided. */
  runId?: string;
  isFloating?: boolean;
}

function getLabelParts(
  sel: LegendSelection,
  cohortDescriptions?: CohortDescriptions,
): { parent: string; sub: string | null } {
  return getCohortLabelParts(
    sel.cohortName,
    (name) => cohortDescriptions?.[name]?.display_name,
  );
}

function makeSpacerId(): string {
  return `spacer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const FigureLegend: FC<FigureLegendProps> = ({ items, onChange, cohortDescriptions, colorOverrides, onSetColor, onReplaceColorOverrides, runId, isFloating }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  // The drop indicator: `index` is the gap where the item will be inserted
  // (0 = before item 0, ..., n = after last item) and `top` is the overlay's
  // pixel offset within the card so it never shifts the row layout.
  const [dropLine, setDropLine] = useState<{ index: number; top: number } | null>(null);

  // ── Saved legend sets ──────────────────────────────────────────────────
  // A change to the ordered items or a cohort color is committed both to the
  // report (via `onChange` / `onSetColor`) and, when a set is active, into that
  // set so it always mirrors the live arrangement.
  const sets = useFigureLegendSets(runId ?? '__no_run__');
  const activeSetId = runId ? sets.activeSetId : null;

  const commitItems = useCallback(
    (next: LegendItem[]) => {
      onChange(next);
      if (activeSetId) sets.updateSetData(activeSetId, { items: next, colorOverrides: colorOverrides ?? {} });
    },
    [onChange, activeSetId, sets, colorOverrides],
  );

  const commitColor = useCallback(
    (cohortName: string, color: string) => {
      onSetColor?.(cohortName, color);
      if (activeSetId) {
        const nextColors = { ...(colorOverrides ?? {}), [cohortName]: color };
        sets.updateSetData(activeSetId, { items, colorOverrides: nextColors });
      }
    },
    [onSetColor, activeSetId, sets, colorOverrides, items],
  );

  // Build the "used colors" list for a given cohort's picker: every other
  // cohort's effective color, so the picker can blur out taken colors.
  const usedColorsFor = useCallback(
    (cohortName: string): ColorUsage[] =>
      items.flatMap((it) =>
        isCohortSelection(it) && it.cohortName !== cohortName
          ? [{ color: getSelectionColor(it, colorOverrides), cohortLabel: getLabelParts(it, cohortDescriptions).parent }]
          : [],
      ),
    [items, colorOverrides, cohortDescriptions],
  );

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  // Resolve the drop gap (and overlay position) from the pointer's Y against the
  // actual row rects. Reading live rects keeps this correct regardless of scroll.
  const computeDropLine = useCallback(
    (clientY: number): { index: number; top: number } | null => {
      const card = cardRef.current;
      if (!card) return null;
      const cardTop = card.getBoundingClientRect().top;
      const rows = Array.from(card.querySelectorAll<HTMLElement>('[data-drop-index]'));
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          return { index: Number(row.dataset.dropIndex), top: rect.top - cardTop };
        }
      }
      const last = rows[rows.length - 1];
      return { index: items.length, top: last ? last.getBoundingClientRect().bottom - cardTop : 0 };
    },
    [items.length],
  );

  // Drag-over/drop live on the card, not individual rows, so releasing anywhere
  // in the list (including over the indicator gap) always lands a valid drop.
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (dragIndexRef.current == null) return;
      e.preventDefault();
      setDropLine(computeDropLine(e.clientY));
    },
    [computeDropLine],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragIndexRef.current;
      const target = computeDropLine(e.clientY);
      dragIndexRef.current = null;
      setDropLine(null);
      if (from == null || target == null) return;
      // Resolve insertion index accounting for the removal of `from`
      const insertAt = target.index > from ? target.index - 1 : target.index;
      if (insertAt === from) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(insertAt, 0, moved);
      commitItems(next);
    },
    [items, commitItems, computeDropLine],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Clear the indicator only when the pointer actually leaves the card.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDropLine(null);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDropLine(null);
  }, []);

  const handleAddSpacer = useCallback(() => {
    const spacer: LegendSpacer = { kind: 'spacer', id: makeSpacerId(), size: 1 };
    commitItems([...items, spacer]);
  }, [items, commitItems]);

  const handleSetSpacerSize = useCallback(
    (index: number, size: 1 | 2 | 3 | 4) => {
      const next = items.map((it, i) =>
        i === index && isSpacer(it) ? { ...it, size } : it,
      );
      commitItems(next);
    },
    [items, commitItems],
  );

  const handleSetSpacerLabel = useCallback(
    (index: number, label: string) => {
      const next = items.map((it, i) =>
        i === index && isSpacer(it) ? { ...it, label } : it,
      );
      commitItems(next);
    },
    [items, commitItems],
  );

  const handleRemoveSpacer = useCallback(
    (index: number) => {
      commitItems(items.filter((_, i) => i !== index));
    },
    [items, commitItems],
  );

  const handleRemoveCohort = useCallback(
    (index: number) => {
      commitItems(items.filter((_, i) => i !== index));
    },
    [items, commitItems],
  );

  const cohortCount = items.filter((it) => !isSpacer(it)).length;

  // Apply a full set (order + spacers + colors) to the live report.
  const applyData = useCallback(
    (data: FigureLegendSetData) => {
      onChange(data.items);
      onReplaceColorOverrides?.(data.colorOverrides);
    },
    [onChange, onReplaceColorOverrides],
  );

  const handleActivateSet = useCallback(
    (setId: string) => {
      // Preserve the live working draft before leaving it for a named set.
      if (sets.activeSetId === null) sets.setScratch({ items, colorOverrides: colorOverrides ?? {} });
      const set = sets.sets.find((s) => s.id === setId);
      if (!set) return;
      applyData(set.data);
      sets.setActive(setId);
    },
    [sets, items, colorOverrides, applyData],
  );

  const handleActivateScratch = useCallback(() => {
    const data = sets.scratch ?? { items, colorOverrides: colorOverrides ?? {} };
    applyData(data);
    sets.setActive(null);
  }, [sets, items, colorOverrides, applyData]);

  const handleSaveNewSet = useCallback(() => {
    const existing = new Set(sets.sets.map((s) => s.name));
    let name = 'Legend set';
    for (let n = 2; existing.has(name); n++) name = `Legend set ${n}`;
    sets.createSet(name, { items, colorOverrides: colorOverrides ?? {} });
  }, [sets, items, colorOverrides]);

  if (cohortCount === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No cohorts selected. Select cohorts in the Cohorts tab.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollRegion}>
        <div ref={scrollRef} className={styles.scrollContent}>
          <div className={styles.hint}>Drag to reorder</div>
          <div
            ref={cardRef}
            className={`${styles.card}${isFloating ? ` ${styles.cardFloating}` : ''}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
          >
            {dropLine && <div className={styles.dropLine} style={{ top: dropLine.top }} />}
            {items.map((item, i) => {
              const dragHandle = (
                <span className={styles.dragHandle} aria-hidden>
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                    <circle cx="3" cy="2.5" r="1.2" /><circle cx="7" cy="2.5" r="1.2" />
                    <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
                    <circle cx="3" cy="11.5" r="1.2" /><circle cx="7" cy="11.5" r="1.2" />
                  </svg>
                </span>
              );

              if (isSpacer(item)) {
                return (
                  <div key={item.id} className={styles.rowWrapper}>
                    <div
                      className={styles.spacerRow}
                      data-drop-index={i}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragEnd={handleDragEnd}
                    >
                      <input
                        className={styles.spacerLabelInput}
                        value={item.label ?? ''}
                        placeholder="Spacer label"
                        onChange={(e) => handleSetSpacerLabel(i, e.target.value)}
                        // Prevent the parent row's drag from hijacking text selection.
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      <div className={styles.spacerSizes}>
                        {SPACER_SIZES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`${styles.spacerSizeButton} ${item.size === s ? styles.spacerSizeButtonActive : ''}`}
                            onClick={() => handleSetSpacerSize(i, s)}
                            title={`Spacing ${s}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.spacerRemove}
                        onClick={() => handleRemoveSpacer(i)}
                        title="Remove spacer"
                        aria-label="Remove spacer"
                      >
                        ×
                      </button>
                      {dragHandle}
                    </div>
                  </div>
                );
              }

              const color = getSelectionColor(item, colorOverrides);
              const { parent, sub } = getLabelParts(item, cohortDescriptions);
              const isDragging = dragIndexRef.current === i;
              return (
                <div key={item.cohortName} className={styles.rowWrapper}>
                  <div
                    className={`${styles.row} ${isDragging ? styles.rowDragging : ''}`}
                    data-drop-index={i}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className={styles.dot}>
                      <LegendDot
                        color={color}
                        isActive
                        showDot={false}
                        onClick={() => {}}
                        onColorChange={onSetColor ? (c) => commitColor(item.cohortName, c) : undefined}
                        usedColors={usedColorsFor(item.cohortName)}
                      />
                    </div>
                    <div className={styles.labelContainer}>
                      <span className={styles.labelParent}>{parent}</span>
                      <span className={styles.labelSub}>{sub ?? 'main cohort'}</span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.spacerRemove} ${styles.rowRemove}`}
                      onClick={() => handleRemoveCohort(i)}
                      title="Remove cohort"
                      aria-label="Remove cohort"
                    >
                      ×
                    </button>
                    {dragHandle}
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className={styles.addSpacerButton} onClick={handleAddSpacer}>
            + Add spacer
          </button>
        </div>
        <div className={styles.scrollbarRegion}>
          <SimpleCustomScrollbar
            targetRef={scrollRef}
            orientation="vertical"
            marginTop={10}
            marginBottom={10}
            marginToEnd={10}
            classNameTrack={styles.scrollBarTrack}
            classNameThumb={styles.scrollBarThumb}
            showOnHover={true}
          />
        </div>
      </div>
      {runId && (
        <FigureLegendSets
          sets={sets.sets}
          activeSetId={sets.activeSetId}
          onActivateSet={handleActivateSet}
          onActivateScratch={handleActivateScratch}
          onSaveNewSet={handleSaveNewSet}
          onRenameSet={sets.renameSet}
          onDeleteSet={sets.deleteSet}
        />
      )}
    </div>
  );
};
