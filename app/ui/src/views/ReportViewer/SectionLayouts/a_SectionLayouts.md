# Section Layouts

A grid-layout system for report **sections**. A section is a group of related
chart rows (e.g. "Demographics", "Diagnoses"). By default a section renders as a
vertical **list**, but it can also be rendered as one of several named **grid
layouts** where each row is placed as a resizable, draggable tile on an
n-column grid. All layout choices are remembered across page reloads.

This document is both a human-oriented overview and a development reference. Use
it to understand the data model, the persistence ("memory") system, how tiles
are sized/positioned/resized, and how the layout controls tie it together.

# Purpose
We have two states, the locked state and the unlocked state

---

## 1. Core concepts

| Term | Meaning |
| --- | --- |
| **Section** | A group of chart rows, identified by a *stable id* (never its display name). Layouts are stored per section. |
| **Row / item** | One chart element (boolean / categorical / numeric / time-to-event). The atomic unit of content. Its `key` is its stable name. |
| **Grid** | An n-column arrangement. Each tile spans a whole number of columns and rows. Contrast with the **list** (single vertical stack). |
| **Tile / cell** | One `GridItem` placement. Renders either a single row or a group of rows. |
| **Group** | A tile that stacks several member rows inside it. Members are removed from the top-level flow and rendered inside the group card. |
| **Layout** | A named configuration: item placements + hidden keys + groups + column count. `activeLayoutId === null` means the list view. |
| **Locked vs. editable** | Locked view has fixed, content-derived heights and no drag/resize. Editable mode adds drag headers and resize grips. The default layout is always locked. |
| **Display variant** | An alternate chart type for a row (e.g. numeric → boxplot vs. table). Stored per row key. |

Key files:

- [sectionLayoutStore.ts](sectionLayoutStore.ts) — state, persistence, types, sizing math, default-layout generation.
- [useGridInteraction.ts](useGridInteraction.ts) — pointer handling: drag, resize, auto-scroll, drop hints.
- [CleanupGridLayout.ts](CleanupGridLayout.ts) — overlap resolution and cohort-delta restacking.
- [GridDropHint.ts](GridDropHint.ts) / [DropSelectionLayout.ts](DropSelectionLayout.ts) — drop intent and reflow.
- [LayoutControls.tsx](LayoutControls.tsx) — per-section dropdown (switch/create/rename/delete/lock, column count).
- [SectionGrid.tsx](SectionGrid.tsx) — renders the locked (masonry) or editable grid.
- [ZoomableSectionGrid.tsx](ZoomableSectionGrid.tsx) — wraps a grid in a pan/zoom viewport (see §12).

---

## 2. Data model

Defined in [sectionLayoutStore.ts](sectionLayoutStore.ts). All grid coordinates
are in **whole grid cells**, not pixels.

```ts
interface GridItem {           // one tile placement
  key: string;                 // row name or group id
  x: number; y: number;        // column / row position (top-left)
  w: number; h: number;        // width / height in grid cells
}

interface CellGroup {          // a tile that hosts several rows
  id: string;                  // group_<ts>_<rand>; used as a GridItem.key
  memberKeys: string[];        // rows rendered inside, in display order
}

interface SectionLayout {      // one named layout
  id: string;
  name: string;
  items: GridItem[];
  hiddenKeys?: string[];       // hidden in this layout
  groups?: CellGroup[];
  columnsPerRow?: number;      // 1–5
}

interface SectionState {       // everything persisted for one section
  layouts: SectionLayout[];
  activeLayoutId: string | null;         // null ⇒ list view
  listHiddenKeys?: string[];             // hidden while in list view
  displayVariants?: Record<string,string>; // row key → variant id
  descriptions?: Record<string,string>;    // row key → description text
}
```

The persisted store is a `Record<sectionId, SectionState>`.

---

## 3. Memory system (persistence & store)

The store is a **singleton** so every consumer (viewer cells, outline panel)
observes the same state without prop drilling. React integration is via
`useSyncExternalStore`.

### Where state lives

- Persisted to `localStorage` under the key **`phenex.sectionLayouts.v2`** as
  JSON of the whole `Record<sectionId, SectionState>`.
- `loadState()` runs once at module load; `saveState()` runs after every
  mutation. Both are wrapped in try/catch — a full/unavailable storage or
  corrupt JSON silently falls back to an empty store (never throws).
- Reads for unknown sections return a **cached empty state** (`emptyFor`) so
  `getSnapshot` returns a stable reference and React doesn't re-render in a loop.

### Stable section ids — why it matters

Layouts are keyed by a *stable* id, never the section's display name (which the
user can rename). `getSectionLayoutId(entry)` derives it:

```ts
entry.sectionId ?? `${entry.category}::${entry.reporter}::${entry.section}`
```

If you key layouts by display name, a rename orphans the saved layout. Always
route through `getSectionLayoutId`.

### Reading & writing

- Hook: `useSectionLayouts(sectionId)` returns the current layout data plus
  memoized action callbacks (`setActiveLayout`, `createLayout`,
  `updateLayoutItems`, `renameLayout`, `deleteLayout`, `toggleItemVisibility`,
  `createGroup`, `ungroup`, `setDisplayVariant`, `setDescription`,
  `setColumnsPerRow`).
- Imperative (outside React render, e.g. building menus): `getSectionState`,
  `sectionLayoutActions`, `getHiddenKeys`, `subscribeSectionLayouts`.
- Every mutation goes through the private `update()` → `saveState()` → `notify()`
  pipeline, so persistence and re-render are automatic. Do **not** mutate
  `SectionState` objects in place; the store always replaces with a new object.

### Editing mode is NOT persisted

Whether a layout is currently unlocked for drag/resize is *session-only* state,
held in a separate in-memory `Set` (`editingSet`) and exposed via
`useLayoutEditing(sectionId) → [isEditing, setEditing]`. It intentionally does
not survive reload — you always reopen a report in the clean, locked view.

### Import / export

`exportSectionLayouts()` returns the whole persisted record;
`importSectionLayouts(state)` replaces it (used to sync layouts with a report
bundle). Both operate on the same `localStorage`-backed store.

---

## 4. Default items (initial layout generation)

When a user creates a new grid (or a column-count change reflows an existing
one), placements are generated by **flow-packing**: fill left-to-right, wrap to
the next row.

```ts
buildDefaultLayoutItems(keys, cohortCount = 1, nCols = 3): GridItem[]
// w = floor(GRID_COLUMNS / nCols)   → each tile spans an equal column slice
// h = defaultTileRows(cohortCount)  → height matches the locked-mode chart
// x = (i % nCols) * w,  y = floor(i / nCols) * h
```

- `GRID_COLUMNS = 60` internal units, so any of 1–5 columns divides cleanly.
- `defaultTileRows(cohortCount)` derives the row span from the *actual*
  locked-mode chart height (see §5), so a fresh grid tile is the same size as
  the list/locked rendering of that row — no visual jump when switching views.
- `LayoutControls.handleNewGrid()` calls `buildDefaultLayoutItems(rowKeys,
  cohortCount, defaultColumns)` then `createLayout(...)`.
- `store.setColumnsPerRow()` regenerates items with the same flow-pack formula
  and **clears** `groups` and `hiddenKeys` (a column change is a full reflow).

New group tiles are placed full-width (`w = GRID_COLUMNS`) directly below all
existing content (`y = max(item.y + item.h)`), so grouping never overlaps.

---

## 5. Height / sizing (locked view)

In locked view, tile heights are **derived from content**, not stored. The
pixel height of a chart is converted to a grid-row span.

Constants ([sectionLayoutStore.ts](sectionLayoutStore.ts)):

| Constant | Value | Role |
| --- | --- | --- |
| `GRID_ROW_HEIGHT` | `12` px | Pixels per grid row (vertical pitch). |
| `GRID_GAP` / `GRID_ROW_GAP` | `14` px | Horizontal / vertical gutter between tiles. |
| `TILE_HEADER_ROWS` | `8` | Min row span for a chart-less tile (title + description). Also the floor when shrinking. |
| `TILE_CHROME_PX` | `60` px | Fixed non-chart overhead (header + description + padding). |
| `PX_PER_COHORT` | `24` px | Boolean chart height per cohort. |
| `BOOLEAN_CHART_OVERHEAD_PX` | `52` px | Fixed overhead added to boolean charts. |
| `NUMERIC_EXTRA_HEIGHT_PX` | `30` px | Extra height for numeric over boolean baseline. |
| `CATEGORICAL_CHART_HEIGHT_PX` | `150` px | Fixed categorical chart height. |

Two functions do the work:

```ts
lockedChartHeight(rowType, cohortCount, spacersPx = 0): number
//   categorical → CATEGORICAL_CHART_HEIGHT_PX
//   numeric     → cohortCount * PX_PER_COHORT + NUMERIC_EXTRA_HEIGHT_PX
//   boolean/…   → cohortCount * PX_PER_COHORT + BOOLEAN_CHART_OVERHEAD_PX + spacersPx

tileRowsFromPx(chartHeightPx): number
//   ceil((chartHeightPx + TILE_CHROME_PX + GRID_ROW_GAP) / GRID_ROW_HEIGHT)
```

So a tile's row span = chart pixels + fixed chrome + one gutter, rounded up to
whole rows. `defaultTileRows(cohortCount)` = `tileRowsFromPx(lockedChartHeight(
'boolean', cohortCount))` and is the seed height for fresh tiles.

**Cohort-count changes** (`restackByCohortDelta` in
[CleanupGridLayout.ts](CleanupGridLayout.ts)): when the number of cohorts
changes, tiles are grown/shrunk by the row *delta only* (never reset), so a
manually resized tile keeps its relative size. Each tile is also shifted in `y`
by `delta × (tiles stacked above it in the same column span)`, preserving manual
gaps. Heights are floored at `TILE_HEADER_ROWS` so a shrunk tile never collapses
to a padding-only sliver.

---

## 6. Positioning & resizing (editable mode)

All pointer interaction lives in
[useGridInteraction.ts](useGridInteraction.ts). It measures the container with a
`ResizeObserver`, converts pixel deltas to cell deltas, maintains a live
**draft** layout during the gesture, and commits on pointer-up.

### Geometry

- `colSpan` = `cellWidth + gap`, `rowSpan` = `rowHeight + rowGap` — the pixel
  pitch of one grid step, used to convert pointer travel → cell deltas.
- A press only becomes a drag after `DRAG_THRESHOLD = 4` px of travel;
  below that it is treated as a click (`onItemClick`).

### Move (drag)

- `startMove(e, key)` records the origin. During move:
  - `dCol = round((clientX - startX) / colSpan)`,
    `dRow = round((clientY - startY + scrollDelta) / rowSpan)`.
  - New position is clamped so the tile stays on-grid:
    `x = clamp(origin.x + dCol, 0, columns - origin.w)`,
    `y = max(0, origin.y + dRow)`.
- Live `dropHint` (see §7) previews where the tile will land (swap / insert / free).

### Resize

- `startResize(e, key, edge)` with `edge ∈ { 'right', 'bottom', 'corner' }`,
  exposing three grips per tile.
- Width: `w = clamp(origin.w + dCol, 1, columns - origin.x)` — at least 1 cell,
  never past the right edge.
- Height: `h = max(minHMap?.get(key) ?? 1, origin.h + dRow)` — floored by the
  per-item minimum row span (`minHMap`), which prevents a tile from being shrunk
  below its header/chart minimum.
- Resize shows **no** drop hint; on commit it only calls `cleanupGridLayout` to
  resolve any overlap the grown tile introduced.

### Commit & overlap resolution

On pointer-up the draft is finalized:

- **Single move** → `resolveSingleDrop(...)` applies swap / insert / free.
- **Multi move** → `dropSelectionIntoGrid(...)` re-inserts the whole selection.
- **Resize** → `cleanupGridLayout(current, columns)`.

`cleanupGridLayout` guarantees zero overlaps with one rule: an item may only
move **down or right**, never up/left, and reading order (top→bottom,
left→right) is preserved so React reconciliation stays stable. `placeFreely`
pins a dropped tile exactly where it landed and only displaces the tiles it
actually overlaps (pushing them `'right'` with wrap, or `'down'`).

The committed items are handed to `onLayoutChange` → `updateLayoutItems`, which
persists them (§3).

### Auto-scroll

While dragging near a scroll-container edge (`EDGE_SCROLL_ZONE = 64` px), a
`requestAnimationFrame` loop scrolls (up to `EDGE_SCROLL_SPEED = 22` px/frame)
and keeps re-applying the drag, so the tile tracks the cursor even when the
pointer is held still.

### Multi-drag

When the grabbed tile is part of the selection, the selected tiles animate into
a stacked deck (`STACK_OFFSET = 7` px per card). A multi-drag only ever
**inserts** (never swaps); on drop, `dropSelectionIntoGrid` flow-packs the whole
selection at the target.

---

## 7. Drop hints (drag affordance)

`computeDropHint(layout, gx, gy, draggedKey, allowSwap)` in
[GridDropHint.ts](GridDropHint.ts) classifies the pointer's grid cell into one
of three intents that drive the visual indicator and the commit:

- **swap** — over the middle of another tile → the two tiles exchange positions.
- **insert** — over an edge/gap → snap to a boundary line and push neighbors.
- **free** — over empty cells → drop exactly there, only pushing overlaps.

`resolveSingleDrop(layout, hint, draggedKey)` applies the chosen intent and runs
collision resolution.

---

## 8. Layout controls

[LayoutControls.tsx](LayoutControls.tsx) is the floating dropdown on a focused
section cell. It mirrors the outline panel's right-click menu.

It offers:

- **Column selector** (`COLUMN_OPTIONS = [1..5]`) — changing it calls
  `setColumnsPerRow`, which reflows the active layout (full flow-pack, groups &
  hidden keys cleared).
- **Lock / unlock button** — toggles `useLayoutEditing` (session-only). Only
  shown for real layouts, never the `__default__` layout. 🔒 = locked, 🔓 =
  editable.
- **Layout menu** — switch to List (`setActiveLayout(null)`) or a named grid,
  create a **New grid** (`Grid N` via `buildDefaultLayoutItems`), rename
  (`window.prompt`), or delete a layout.

`defaultColumns` is a *responsive* value: `useResponsiveColumns` maps the card's
measured width to a column count (breakpoints roughly 500 / 800 / 1000 / 1300
px → 1–5 columns). A responsive change re-runs `setColumnsPerRow` **only while
locked** (an effect skips it during active editing so it never fights a user's
manual layout).

---

## 9. Component hierarchy & data flow

```
HorizontalCell (ReportViewer)
└─ SectionCellContent            ── wrapper; always grid, seeds a default if none
   └─ SectionGridContent         ── orchestrator: selection, visibility, actions
      ├─ LayoutControls          ── switch / create / lock / column count
      ├─ ZoomableSectionGrid     ── pan/zoom viewport (usePanZoom + scrollbar + scrubber)
      │  └─ SectionGrid          ── chooser:
      │      ├─ MasonrySectionGrid  ──   locked: content-sized columns, read-only
      │      └─ EditableSectionGrid ──   editable: uses useGridInteraction()
      │          └─ (draggable tiles + resize grips + drop indicator)
      ├─ GroupCard               ── renders a group tile's stacked members
      │   └─ SectionRowRenderer  ── dispatches to the right chart renderer
      ├─ MultiSelectControls     ── floating toolbar (portal) for the selection
      ├─ useMultiSelectActions   ── group / change type / reset size / hide
      └─ useGridSelection        ── selected keys + Esc / Cmd-A shortcuts
```

State flows down from `useSectionLayouts(sectionId)`; user gestures flow back up
through `onLayoutChange` → `updateLayoutItems` → the persisted store.

---

## 10. Gesture-to-persistence lifecycle

```
pointerdown on header ─► useGridInteraction.startMove()
        │                    ├─ in selection? → multi-drag (stacked deck)
        │                    └─ else          → single-drag
pointermove (rAF) ─────► apply cell delta → draft layout
        │                    ├─ auto-scroll near edges
        │                    └─ computeDropHint() → preview
pointerup ─────────────► commit()
                             ├─ single → resolveSingleDrop()  (swap/insert/free)
                             ├─ multi  → dropSelectionIntoGrid()
                             └─ resize → cleanupGridLayout()
                        onLayoutChange() → store.updateLayoutItems()
                                         → saveState() → localStorage
```

---

## 11. Development notes / gotchas

- **Never key layouts by display name.** Use `getSectionLayoutId(entry)`.
- **Grid units, not pixels.** `GridItem` `x/y/w/h` are cells. Convert with
  `GRID_ROW_HEIGHT`, `GRID_COLUMNS`, `colSpan`/`rowSpan`.
- **Don't mutate store state in place.** All mutations replace objects and go
  through `update()` so `saveState`/`notify` fire.
- **Overlap invariant:** after any free-form gesture, always run through
  `cleanupGridLayout` / `placeFreely`. Items only move down/right.
- **Editing mode is ephemeral** (session `Set`), deliberately not persisted.
- **Column change is destructive to groups/hidden keys** — `setColumnsPerRow`
  regenerates items and clears both. Warn users if you surface it elsewhere.
- **Height on resize is floored by `minHMap`**; supply an accurate minimum span
  per key or tiles can be shrunk below their content.
- Persistence is best-effort: `localStorage` failures are swallowed, so don't
  rely on writes throwing on quota errors.

---

## 12. Pan & zoom (implemented)

Every section grid is wrapped in a pan/zoom viewport by
[ZoomableSectionGrid.tsx](ZoomableSectionGrid.tsx), which drives the shared
[usePanZoom](../../../hooks/usePanZoom.ts) hook.

**Behavior** (matches the StudyViewer canvas):

- Plain wheel → pan up/down (i.e. normal scroll); `shift`+wheel → horizontal.
- `Cmd`/`Ctrl`+wheel and trackpad **pinch** → zoom around the cursor.
- Drag the background → pan. Tiles carry `data-no-pan`, so dragging a tile still
  moves/resizes it instead of panning.
- 200 ms guard after a zoom suppresses inertial pan.

**Chrome:**

- [PanZoomScrollbar](../../../components/CustomScrollbar/PanZoomScrollbar/PanZoomScrollbar.tsx)
  renders the custom H/V scrollbars. Each track is `display:none` unless the
  *scaled* content overflows the viewport, so scrollbars appear purely as a
  function of the zoom/scroll state.
- A `ZoomScrubber` + a `reset view` button (shown only when not at home).

**Scale correctness:**

- The live `scale` is threaded `ZoomableSectionGrid → SectionGrid →
  useGridInteraction`. Every pointer delta is divided by `scale` (via
  `scaleRef`), so tile drag / resize / drop-hints stay pixel-accurate at any
  zoom.
- Descendant charts read the scale via `PanZoomScaleProvider` / `--pz-scale`.

**Persistence & layout:**

- The pan/zoom transform is persisted per section+layout under
  `phenex.sectionZoom.<sectionId>.<layoutId>` — separate from the layout store.
- [HorizontalCell.module.css](../HorizontalRowViewer/HorizontalCell.module.css)
  `.cardContentSection` is a bounded flex box (`flex:1; min-height:0`) so the
  viewport (`position:absolute; inset:0`) fills it and owns scrolling/zooming.

**Caveat:** because section cells now scroll via the pan viewport rather than the
native `.verticalWrapper`, the breadcrumb-header-on-scroll reveal
(`onVerticalScroll`) no longer fires for section cells (non-section cells are
unchanged).

---

## 13. Planned: infinite canvas (free xy positioning)

> **Status: design only — not yet implemented.**

**Goal.** In the unlocked (editable) state, treat a layout as an *infinite
canvas*: every item/cell holds an arbitrary `(x, y)` position that is saved in
the layout, and the user pans/zooms (§12) to move around. No auto-packing —
items stay exactly where they are dropped; overlaps are allowed.

`GridItem` already carries `x, y, w, h`; the change is about **relaxing the grid
constraints** (clamping, collision cleanup, viewport-relative units) rather than
adding fields.

### 13.1 What blocks "free xy" today

| Constraint | Where | Change for canvas |
| --- | --- | --- |
| `x` clamped to `columns - w`, `w` clamped to `columns` | `useGridInteraction` move/resize | Drop the clamp in canvas mode (allow x/w past 60). |
| Overlap cleanup (down/right reflow) on every commit | `cleanupGridLayout` / `resolveSingleDrop` in `handleUp` | Skip in canvas mode — commit raw positions. |
| Cell width is **viewport-relative** (`containerWidth / columns`) | `useGridInteraction` `cellWidth` | Use a **fixed** `CANVAS_UNIT_PX` so xy are absolute, not viewport-dependent. |
| Grid width is fixed to the viewport; only height grows | `SectionGrid` / `displayHeight` | Size the content to the **bounding box** of all items (grows right & down). |
| Cohort-delta restacking shifts `y` of tiles below | `restackByCohortDelta` | In canvas mode grow each tile's height in place; do not shift `y`. |
| Masonry locked view ignores exact xy | `MasonrySectionGrid` | Locked canvas layout renders items at their saved xy (read-only). |

### 13.2 Data model

- Add an opt-in flag on the layout so packed layouts keep working:
  ```ts
  interface SectionLayout {
    /* … */
    freeform?: boolean;   // true ⇒ infinite-canvas, no packing/clamping
  }
  ```
  The `__default__` layout stays packed/masonry; new grids can default to
  `freeform: true`.
- `x, y, w, h` keep their meaning (grid cells) but in canvas mode are **absolute
  canvas cells** at a fixed pixel unit, independent of viewport width.
- Pan/zoom transform already persists per section+layout (§12). Optionally move
  it into `SectionState` if we want it to travel with export/import.

### 13.3 Coordinate units (the key decision)

Today `cellWidth = (containerWidth − gaps) / columns`, so `x` is viewport-relative
— resizing the card would move items. For a canvas, define a **fixed** unit
(e.g. reuse `GRID_ROW_HEIGHT = 12` for both axes, or a dedicated
`CANVAS_UNIT_PX`). Then `colSpan = rowSpan = CANVAS_UNIT_PX`, and
`left = x * unit`, `top = y * unit` are stable absolute coordinates.
Keep round-to-unit snapping on drag; a "free/snap" toggle can come later.

Origin stays at top-left `(0, 0)` and the canvas grows right/down (all
coordinates ≥ 0) — simpler than supporting negative space; recenter is handled
by pan.

### 13.4 Rendering

- Introduce a canvas branch (either a `CanvasSectionGrid` or a `freeform` mode in
  `EditableSectionGrid`) that:
  - positions each tile absolutely at `x*unit, y*unit`, size `w*unit × h*unit`;
  - sets the content size to `maxRight = max(x+w)*unit`,
    `maxBottom = max(y+h)*unit` (+ margin), so `usePanZoom.measure()` derives
    correct pan bounds and scrollbars;
  - calls `pz.remeasure()` whenever the bounding box changes (already wired via
    `measureKey`, extend to include width).

### 13.5 Interaction (`useGridInteraction`)

- **Move:** `x = origin.x + dCol`, `y = origin.y + dRow` (no clamp, snap by
  round). Commit the draft **directly** — skip `resolveSingleDrop` /
  `cleanupGridLayout`.
- **Resize:** unchanged math, but no overlap cleanup afterwards.
- **Multi-drag:** translate every selected item by the same `(dCol, dRow)` delta
  (a new "translate" commit path) instead of `dropSelectionIntoGrid` flow-pack.
- **Drop hints:** disabled in canvas mode (no swap/insert). Optional later:
  alignment guides / snap lines instead.
- **Edge behavior:** replace the scroll-parent auto-scroll with **edge-pan** —
  when a tile is dragged near a viewport edge, pan the canvas via a small
  imperative `panBy(dx, dy)` added to `usePanZoom` (keep the drag tracking the
  cursor as the canvas moves).

### 13.6 Controls & migration

- `LayoutControls`: "New grid" creates a `freeform` layout by default; add a
  toggle to convert an existing packed layout to canvas (keep current positions
  as the starting xy — packed layouts are already a valid free arrangement).
- Column selector becomes a *seed* for initial placement only (no longer clamps).

### 13.7 Suggested phases

1. `freeform` flag + fixed-unit coordinates + bounding-box content sizing
   (render only; still uses existing commit).
2. Free move/resize commit (drop clamp + cleanup in canvas mode).
3. Multi-drag translate.
4. `usePanZoom.panBy` + edge-pan while dragging.
5. `LayoutControls` toggle + cohort-delta "grow in place".
6. Optional: alignment guides, snap toggle, persist canvas transform in
   `SectionState`.

### 13.8 Open decisions

- Allow overlapping tiles? (assumed **yes** for a canvas.)
- Snap-to-unit vs fully free positioning (assumed **snap**, with a later toggle).
- Non-negative coordinates only, or allow negative space + recenter? (assumed
  **non-negative**.)
- Keep masonry as the locked/default rendering, canvas only for `freeform`
  named layouts? (assumed **yes**.)
