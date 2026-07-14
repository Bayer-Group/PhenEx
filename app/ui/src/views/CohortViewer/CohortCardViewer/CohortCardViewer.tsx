import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './CohortCardViewer.module.css';
import { TableData } from '../tableTypes';
import { CohortCardViewerPinnedCols } from './CohortCardViewerPinnedCols';
import { CohortCardViewerScrollCols } from './CohortCardViewerScrollCols';
import { CohortCardRow } from './CohortCardRow';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import {
  ShimApi,
  ShimBacking,
  createShimApi,
  isColumnEditable,
  makeColumn,
  makeNode,
} from './gridApiShim';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import { resolveHeaderCellRenderer } from './CohortCardHeaderCell';
import { getHierarchicalBackgroundColor } from '../CohortTable/CellRenderers/PhenexCellRenderer';

interface CohortCardViewerProps {
  data: TableData;
  currentlyViewing: string;
  onCellValueChanged?: (event: any, selectedRows?: any[]) => void;
  onRowDragEnd?: (newRowData: any[]) => void;
  hideScrollbars?: boolean;
  hideVerticalScrollbar?: boolean;
  gridBottomPadding?: number;
  flipScrollDirection?: boolean;
}

interface EditingState {
  rowId: string;
  field: string;
  eventKey?: string;
}

export const CohortCardViewer = forwardRef<any, CohortCardViewerProps>(
  (
    {
      data,
      onCellValueChanged,
      onRowDragEnd,
      gridBottomPadding = 0,
      flipScrollDirection = false,
    },
    ref
  ) => {
    // --- Internal grid data (updated either via props.data or api.setGridOption) ---
    const [rows, setRows] = useState<any[]>(data?.rows ?? []);
    const [columns, setColumns] = useState<any[]>(data?.columns ?? []);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editing, setEditing] = useState<EditingState | null>(null);
    const [, forceTick] = useState(0);

    // --- Drag state ---
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [armedRowId, setArmedRowId] = useState<string | null>(null);

    // --- Live refs so shim callbacks read current values ---
    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    const columnsRef = useRef(columns);
    columnsRef.current = columns;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    const editingRef = useRef<EditingState | null>(editing);
    editingRef.current = editing;
    const activeEditorRef = useRef<React.RefObject<any> | null>(null);
    const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

    const rootRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pinnedContentRef = useRef<HTMLDivElement>(null);
    const prevScrollTopRef = useRef(0);
    const pinnedRowEls = useRef<Map<string, HTMLDivElement>>(new Map());
    const scrollRowEls = useRef<Map<string, HTMLDivElement>>(new Map());
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const heightSyncRafRef = useRef<number>(0);

    // Keep internal state in sync when the data prop changes.
    useEffect(() => {
      if (data?.rows) setRows(data.rows);
      if (data?.columns) setColumns(data.columns);
    }, [data]);

    // --- Column split: pinned (left) vs scrollable (right) ---
    const pinnedColumns = useMemo(() => columns.filter(c => c.pinned === 'left' || c.pinned === true), [columns]);
    const scrollColumns = useMemo(() => columns.filter(c => !(c.pinned === 'left' || c.pinned === true)), [columns]);
    const scrollColumnsRef = useRef(scrollColumns);
    scrollColumnsRef.current = scrollColumns;

    const pinnedWidth = useMemo(
      () => pinnedColumns.reduce((sum, c) => sum + (c.flex ? 250 : c.width ?? 150), 0),
      [pinnedColumns]
    );
    const scrollWidth = useMemo(
      () => scrollColumns.reduce((sum, c) => sum + (c.width ?? 150), 0),
      [scrollColumns]
    );

    // ---------------------------------------------------------------------------
    // Editing lifecycle
    // ---------------------------------------------------------------------------
    const commitEdit = useCallback(
      (cancel?: boolean) => {
        const ed = editingRef.current;
        if (!ed) return;
        const editorRefObj = activeEditorRef.current;
        setEditing(null);
        activeEditorRef.current = null;
        if (cancel) return;

        const row = rowsRef.current.find(r => (r?.id ?? '') === ed.rowId);
        const colDef = columnsRef.current.find(c => c.field === ed.field);
        if (!row || !colDef) return;

        const rawValue = editorRefObj?.current?.getValue?.();
        const oldValue = row[ed.field];
        let newValue = rawValue;
        if (typeof colDef.valueParser === 'function') {
          newValue = colDef.valueParser({
            newValue: rawValue,
            oldValue,
            data: row,
            colDef,
            api: apiRef.current,
          });
        }

        const rowIndex = rowsRef.current.indexOf(row);
        const event = {
          data: row,
          colDef,
          column: makeColumn(colDef),
          node: makeNode(row, rowIndex, backingRef.current),
          newValue,
          oldValue,
          api: apiRef.current,
        };
        const selectedRows = apiRef.current.getSelectedRows();
        onCellValueChanged?.(event, selectedRows);
      },
      [onCellValueChanged]
    );

    const startEditingCell = useCallback(
      (params: { rowIndex: number; colKey: string; key?: string }) => {
        const row = rowsRef.current[params.rowIndex];
        const colDef = columnsRef.current.find(c => c.field === params.colKey);
        if (!row || !colDef) return;
        if (!isColumnEditable(colDef, row, apiRef.current)) return;
        // Commit any in-flight edit before starting a new one.
        if (editingRef.current) commitEdit();
        setEditing({ rowId: row.id ?? String(params.rowIndex), field: params.colKey, eventKey: params.key });
      },
      [commitEdit]
    );

    // ---------------------------------------------------------------------------
    // Shim backing + api
    // ---------------------------------------------------------------------------
    const apiRef = useRef<ShimApi>(null as unknown as ShimApi);
    const backingRef = useRef<ShimBacking>(null as unknown as ShimBacking);

    const backing: ShimBacking = useMemo(
      () => ({
        getRows: () => rowsRef.current,
        getColumns: () => columnsRef.current,
        getSelectedIds: () => selectedIdsRef.current,
        setSelected: (id: string, selected: boolean) => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            if (selected) next.add(id);
            else next.delete(id);
            return next;
          });
        },
        deselectAll: () => setSelectedIds(new Set()),
        startEditingCell,
        stopEditing: (cancel?: boolean) => commitEdit(cancel),
        requestRefresh: () => forceTick(t => t + 1),
        ensureRowVisible: (id: string) => {
          const el = scrollRowEls.current.get(id) || pinnedRowEls.current.get(id);
          el?.scrollIntoView({ block: 'nearest' });
        },
        setGridOption: (key: string, value: any) => {
          if (key === 'rowData') setRows(value ?? []);
          else if (key === 'columnDefs') setColumns(value ?? []);
        },
      }),
      [startEditingCell, commitEdit]
    );
    backingRef.current = backing;

    const api = useMemo(() => createShimApi(backing), [backing]);
    apiRef.current = api;

    // ---------------------------------------------------------------------------
    // Selection sync with the right (phenotype) panel — mirrors CohortTable
    // ---------------------------------------------------------------------------
    useEffect(() => {
      const service = TwoPanelCohortViewerService.getInstance();
      const handle = (viewType: any, extraData: any) => {
        if (viewType === 'phenotype' && extraData?.id) {
          setSelectedIds(new Set([extraData.id]));
        } else {
          setSelectedIds(new Set());
        }
      };
      service.addListener(handle);
      handle(service.getCurrentViewType(), service.getExtraData());
      return () => service.removeListener(handle);
    }, [rows]);

    // Escape clears selection.
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (editingRef.current) commitEdit(true);
          else setSelectedIds(new Set());
        }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [commitEdit]);

    // ---------------------------------------------------------------------------
    // Row height sync: each row's height = its tallest cell across BOTH panels.
    // Heights are applied imperatively (not via React state) and re-synced via a
    // ResizeObserver so async content growth (codelist chips, icons, fonts) keeps
    // the pinned and scrolling halves perfectly aligned.
    // ---------------------------------------------------------------------------
    const syncRowHeights = useCallback(() => {
      const currentRows = rowsRef.current;
      // 1. Clear applied heights so we can read each row's natural (tallest-cell) height.
      currentRows.forEach((r, i) => {
        const id = r?.id ?? String(i);
        const p = pinnedRowEls.current.get(id);
        const s = scrollRowEls.current.get(id);
        if (p) p.style.height = '';
        if (s) s.style.height = '';
      });
      // 2. Measure natural heights, then apply the per-row max to both panels.
      currentRows.forEach((r, i) => {
        const id = r?.id ?? String(i);
        const p = pinnedRowEls.current.get(id);
        const s = scrollRowEls.current.get(id);
        const h = Math.max(p?.offsetHeight ?? 0, s?.offsetHeight ?? 0, 24);
        if (p) p.style.height = `${h}px`;
        if (s) s.style.height = `${h}px`;
      });
    }, []);

    const scheduleRowHeightSync = useCallback(() => {
      if (heightSyncRafRef.current) return;
      heightSyncRafRef.current = requestAnimationFrame(() => {
        heightSyncRafRef.current = 0;
        syncRowHeights();
      });
    }, [syncRowHeights]);

    // Observe row elements so content resizes trigger a re-sync.
    useEffect(() => {
      const ro = new ResizeObserver(() => scheduleRowHeightSync());
      resizeObserverRef.current = ro;
      return () => {
        ro.disconnect();
        resizeObserverRef.current = null;
        if (heightSyncRafRef.current) cancelAnimationFrame(heightSyncRafRef.current);
      };
    }, [scheduleRowHeightSync]);

    // Re-sync whenever the rendered rows/columns or edit state change.
    useLayoutEffect(() => {
      scheduleRowHeightSync();
    }, [rows, columns, editing, scheduleRowHeightSync]);

    // ---------------------------------------------------------------------------
    // Row interaction handlers
    // ---------------------------------------------------------------------------
    const registerRowRef = useCallback(
      (panel: 'pinned' | 'scroll', id: string, el: HTMLDivElement | null) => {
        const map = panel === 'pinned' ? pinnedRowEls.current : scrollRowEls.current;
        const prev = map.get(id);
        if (prev && prev !== el) resizeObserverRef.current?.unobserve(prev);
        if (el) {
          map.set(id, el);
          resizeObserverRef.current?.observe(el);
        } else {
          if (prev) resizeObserverRef.current?.unobserve(prev);
          map.delete(id);
        }
        scheduleRowHeightSync();
      },
      [scheduleRowHeightSync]
    );

    const registerEditor = useCallback(
      (editorRef: React.RefObject<any>) => {
        activeEditorRef.current = editorRef;
      },
      []
    );

    const handleRowMouseDown = useCallback((e: React.MouseEvent, _rowIndex: number) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      const target = e.target as HTMLElement;
      if (target.closest('[data-field="rowDrag"]')) {
        const rowEl = target.closest('[data-row-id]') as HTMLElement | null;
        const id = rowEl?.getAttribute('data-row-id');
        if (id) setArmedRowId(id);
      }
    }, []);

    const handleRowClick = useCallback((e: React.MouseEvent, rowData: any, _rowIndex: number) => {
      // Ignore clicks that were actually drags.
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        mouseDownPosRef.current = null;
        if (dx > 5 || dy > 5) return;
      }
      const id = rowData?.id;
      if (!id) return;
      const additive = e.metaKey || e.ctrlKey;
      setSelectedIds(prev => {
        const next = new Set(additive ? prev : []);
        if (additive && prev.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }, []);

    const handleContextMenu = useCallback((_e: React.MouseEvent, _rowIndex: number) => {
      // Context menu is owned by the surrounding view; no-op here for parity.
    }, []);

    // --- Drag reorder (HTML5 DnD), mirrors CohortTable.handleRowDragEnd ---
    const handleDragStart = useCallback((e: React.DragEvent, rowIndex: number) => {
      e.dataTransfer.effectAllowed = 'move';
      setDraggedIndex(rowIndex);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, rowIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(rowIndex);
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent, rowIndex: number) => {
        e.preventDefault();
        const from = draggedIndex;
        const to = rowIndex;
        setDraggedIndex(null);
        setDragOverIndex(null);
        setArmedRowId(null);
        if (from === null || from === to) return;

        const newRowData = [...rowsRef.current];
        const [moved] = newRowData.splice(from, 1);
        newRowData.splice(to, 0, moved);

        // Validate and re-index within each type, like CohortTable.
        const invalid = newRowData.filter(r => !r.id || !r.type);
        if (invalid.length > 0) return;
        const grouped: Record<string, any[]> = {};
        newRowData.forEach(r => {
          (grouped[r.type] = grouped[r.type] || []).push(r);
        });
        Object.keys(grouped).forEach(type => {
          grouped[type].forEach((p, i) => {
            p.index = i + 1;
          });
        });

        setRows(newRowData);
        onRowDragEnd?.(newRowData);
      },
      [draggedIndex, onRowDragEnd]
    );

    const handleDragEnd = useCallback(() => {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setArmedRowId(null);
    }, []);

    // ---------------------------------------------------------------------------
    // Imperative handle (drop-in for the CohortTable ref used by CohortViewer)
    // ---------------------------------------------------------------------------
    const scrollByColumn = useCallback(
      (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;

        // Build cumulative left-edge positions for each scroll column.
        const boundaries = scrollColumnsRef.current.reduce<number[]>((acc, col) => {
          const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
          acc.push(prev + (col.width ?? 150));
          return acc;
        }, [0]);
        // boundaries[i] = left edge of column i; last entry = total scroll width

        const current = el.scrollLeft;
        let target: number;
        if (direction === 'right') {
          // Snap to the first boundary strictly greater than current position.
          target = boundaries.find(b => b > current + 1) ?? boundaries[boundaries.length - 1];
        } else {
          // Snap to the last boundary strictly less than current position.
          const candidates = boundaries.filter(b => b < current - 1);
          target = candidates.length > 0 ? candidates[candidates.length - 1] : 0;
        }
        el.scrollTo({ left: target, behavior: 'smooth' });
      },
      []
    );
    const getScrollPercentage = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return 0;
      const max = el.scrollWidth - el.clientWidth;
      return max <= 0 ? 0 : (el.scrollLeft / max) * 100;
    }, []);
    const scrollToPercentage = useCallback((percentage: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft = (percentage / 100) * max;
    }, []);

    // Sync vertical scroll between both panels via direct scrollTop assignment.
    // The equality guard prevents a ping-pong loop: by the time the programmatic
    // scroll event fires on the other panel, the source element already has the
    // new scrollTop, so the guard short-circuits.
    const handleScrollPanelScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const top = e.currentTarget.scrollTop;
      // If scrollTop didn't change, this event was fired by a scrollLeft update
      // (e.g. the NavBar scrubber). Skip vertical sync to avoid glitches.
      if (top === prevScrollTopRef.current) return;
      prevScrollTopRef.current = top;
      if (pinnedContentRef.current && pinnedContentRef.current.scrollTop !== top) {
        pinnedContentRef.current.scrollTop = top;
      }
    }, []);

    const handlePinnedBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const top = e.currentTarget.scrollTop;
      if (scrollRef.current && scrollRef.current.scrollTop !== top) {
        scrollRef.current.scrollTop = top;
      }
    }, []);

    // Shared vertical sync: set scrollTop on both panels simultaneously so they
    // never drift apart (the same technique used by SimpleCustomScrollbar drag).
    const syncVerticalScroll = useCallback((delta: number) => {
      const scrollEl = scrollRef.current;
      const pinnedEl = pinnedContentRef.current;
      if (!scrollEl) return;
      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      const newTop = Math.max(0, Math.min(scrollEl.scrollTop + delta, maxScroll));
      scrollEl.scrollTop = newTop;
      if (pinnedEl) pinnedEl.scrollTop = newTop;
      prevScrollTopRef.current = newTop;
    }, []);

    // Attach a single non-passive wheel listener on the root container via event delegation.
    // This avoids a race where pinnedContentRef/scrollRef are null at effect-setup time
    // (e.g. when rows starts empty and mounts later). Reading the refs at dispatch time
    // ensures we always have the current elements.
    //
    // — Vertical wheel over pinned panel: sync both panels together (no jitter).
    // — Vertical wheel over scroll panel: sync both panels (or remap when flipScrollDirection).
    // — Horizontal wheel over pinned panel: suppressed (pinned cols don't scroll horizontally).
    // — Horizontal wheel over scroll panel in normal mode: native scroll.
    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;

      const handler = (e: WheelEvent) => {
        const scrollEl = scrollRef.current;
        const pinnedEl = pinnedContentRef.current;
        if (!scrollEl) return;

        const isVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
        const overPinned = pinnedEl && pinnedEl.contains(e.target as Node);
        const overScroll = scrollEl.contains(e.target as Node);

        if (overPinned) {
          // Pinned panel — always intercept: redirect vertical, suppress horizontal
          e.preventDefault();
          if (isVertical) syncVerticalScroll(e.deltaY);
          // horizontal: no-op (pinned cols have no horizontal scroll)
        } else if (overScroll) {
          if (flipScrollDirection) {
            e.preventDefault();
            if (e.shiftKey) {
              const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
              syncVerticalScroll(delta);
            } else if (isVertical) {
              // Plain vertical wheel → horizontal scroll (flipped)
              scrollEl.scrollLeft += e.deltaY;
            } else {
              scrollEl.scrollLeft += e.deltaX;
            }
          } else if (isVertical) {
            // Vertical wheel → sync both panels together (no jitter)
            e.preventDefault();
            syncVerticalScroll(e.deltaY);
          }
          // Horizontal wheel in normal mode: let native scroll handle it
        }
      };

      root.addEventListener('wheel', handler, { passive: false });
      return () => root.removeEventListener('wheel', handler);
    }, [flipScrollDirection, syncVerticalScroll]);

    useImperativeHandle(
      ref,
      () => ({
        api,
        eGridDiv: rootRef.current,
        scrollByColumn,
        scrollToPercentage,
        getScrollPercentage,
      }),
      [api, scrollByColumn, scrollToPercentage, getScrollPercentage]
    );

    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------
    const renderHeaderRow = (cols: any[]) => (
      <div className={styles.headerRow} data-header-row>
        {cols.map(colDef => {
          const HeaderCell = resolveHeaderCellRenderer(colDef.field);
          return <HeaderCell key={colDef.field} colDef={colDef} />;
        })}
      </div>
    );

    const renderRows = (panel: 'pinned' | 'scroll', cols: any[]) =>
      rows.map((rowData, rowIndex) => {
        const id = rowData?.id ?? String(rowIndex);
        const isEditingRow = editing != null && editing.rowId === id;
        return (
          <div key={id} data-row-id={id} style={{ display: 'contents' }}>
            <CohortCardRow
              rowData={rowData}
              rowIndex={rowIndex}
              columns={cols}
              api={api}
              backing={backing}
              isSelected={selectedIds.has(id)}
              isDragging={draggedIndex === rowIndex}
              isDragOver={dragOverIndex === rowIndex}
              editingField={isEditingRow ? editing!.field : null}
              editingEventKey={isEditingRow ? editing!.eventKey : undefined}
              enableDrag={armedRowId === id}
              registerRowRef={(rid, el) => registerRowRef(panel, rid, el)}
              registerEditor={registerEditor}
              onRowMouseDown={handleRowMouseDown}
              onRowClick={handleRowClick}
              onContextMenu={handleContextMenu}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          </div>
        );
      });

    return (
      <div
        ref={rootRef}
        className={`${styles.viewerRoot} ag-root ${flipScrollDirection ? styles.flipScroll : ''}`}
      >
        {rows.length === 0 ? (
          <div className={styles.emptyState}>No phenotypes defined</div>
        ) : (
          <>
            <CohortCardViewerPinnedCols ref={pinnedContentRef} width={pinnedWidth} header={renderHeaderRow(pinnedColumns)} bottomPadding={gridBottomPadding} chinColor={getHierarchicalBackgroundColor(rows[rows.length - 1]?.effective_type, rows[rows.length - 1]?.hierarchical_index) ?? undefined} onScroll={handlePinnedBodyScroll}>
              {renderRows('pinned', pinnedColumns)}
            </CohortCardViewerPinnedCols>
            <CohortCardViewerScrollCols
              ref={scrollRef}
              contentWidth={scrollWidth}
              bottomPadding={gridBottomPadding}
              onScroll={handleScrollPanelScroll}
            >
              {renderHeaderRow(scrollColumns)}
              {renderRows('scroll', scrollColumns)}
            </CohortCardViewerScrollCols>
            <div className={styles.scrollbarRegion}>
              <SimpleCustomScrollbar
                targetRef={scrollRef}
                orientation="vertical"
                marginTop={28}
                marginBottom={10}
                marginToEnd={10}
                classNameTrack={styles.scrollBarTrack}
                classNameThumb={styles.scrollBarThumb}
                showOnHover={true}
              />
            </div>
          </>
        )}
      </div>
    );
  }
);

CohortCardViewer.displayName = 'CohortCardViewer';
