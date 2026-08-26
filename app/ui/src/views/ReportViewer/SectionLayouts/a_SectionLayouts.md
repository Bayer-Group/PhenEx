# Section Layouts

A grid-layout system for report **sections**. A section is a group of related
chart rows (e.g. "Demographics", "Diagnoses"). Every section renders as a
resizable, draggable **grid**. Five **default views** (1–5 columns) are always
available and directly editable; the moment a default is edited it forks into a
**draft** that the user can name and **save** as a permanent layout. All saved
layout choices are remembered across page reloads.

This document is both a human-oriented overview and a development reference. Use
it to understand the data model, the persistence ("memory") system, how tiles
are sized/positioned/resized, and how the layout controls tie it together.

# Purpose
Every grid is directly editable (free canvas — no lock step). The five default
views are generated on the fly; editing one spawns a draft in the background
with a prominent "save layout?" prompt. If the user saves it, it becomes a named
layout; otherwise it is discarded on the next reload.

---

## 1. Core concepts

| Term | Meaning |
| --- | --- |
| **Section** | A group of chart rows, identified by a *stable id* (never its display name). Layouts are stored per section. |
| **Row / item** | One chart element (boolean / categorical / numeric / time-to-event). The atomic unit of content. Its `key` is its stable name. |
| **Grid** | An n-column arrangement. Each tile spans a whole number of columns and rows. Contrast with the **list** (single vertical stack). |
| **Tile / cell** | One `GridItem` placement. Renders either a single row or a group of rows. |
| **Group** | A tile that stacks several member rows inside it. Members are removed from the top-level flow and rendered inside the group card. |
| **Layout** | A named configuration: item placements + hidden keys + groups + column count. Saved layouts live in `layouts`; the five defaults and any in-progress draft are synthetic/transient. |
| **Default view** | One of five always-available synthetic grid layouts (1–5 columns), keyed by id `__default_<n>__`. Never stored in `layouts`; regenerated from the current rows/cohort count. |
| **Draft** | The session-only working copy spawned when a default view is edited (`SectionLayout.draft === true`). Shown with a "save layout?" prompt; stripped on reload unless saved. |
| **Editable free canvas** | Every grid is directly draggable/resizable — there is no lock/unlock step. Tiles hold an arbitrary `(x, y)` and commit raw (no reflow). |
| **Display variant** | An alternate chart type for a row (e.g. numeric → boxplot vs. table). Stored per row key. |

Key files:

- [sectionLayoutStore.ts](sectionLayoutStore.ts) — state, persistence, types, sizing math, default-layout generation.
- [useGridInteraction.ts](useGridInteraction.ts) — pointer handling: free-canvas drag & resize.
- [restackLayout.ts](restackLayout.ts) — cohort-delta restacking (tile heights follow the cohort count).
- [LayoutControls.tsx](LayoutControls.tsx) — per-section dropdown (switch/create/rename/delete/lock, column count).
- [SectionGrid.tsx](SectionGrid.tsx) — renders the locked (masonry) or editable (free-canvas) grid.
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
  draft?: boolean;             // session-only working copy (stripped on load)
}

interface SectionState {       // everything persisted for one section
  layouts: SectionLayout[];              // saved layouts (+ at most one live draft)
  activeLayoutId: string | null;         // null ⇒ responsive default; `__default_<n>__` ⇒ that default
  listHiddenKeys?: string[];             // legacy: hidden keys carried per section
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
  `createDraftLayout`, `saveDraft`, `updateLayoutItems`, `renameLayout`,
  `deleteLayout`, `toggleItemVisibility`, `createGroup`, `ungroup`,
  `setDisplayVariant`, `setDescription`).
- Imperative (outside React render, e.g. building menus): `getSectionState`,
  `sectionLayoutActions`, `getHiddenKeys`, `subscribeSectionLayouts`.
- Every mutation goes through the private `update()` → `saveState()` → `notify()`
  pipeline, so persistence and re-render are automatic. Do **not** mutate
  `SectionState` objects in place; the store always replaces with a new object.

### Default views & drafts (the edit-to-save flow)

There is no persisted "list" view any more. When no saved layout is active,
`activeLayoutId` is either `null` (use the responsive default column count) or
`__default_<n>__` (an explicit 1–5 column default). [SectionCellContent](SectionCellContent.tsx)
builds the synthetic default layout for the active column count on every render,
so it always matches the current rows/cohort count and is never stored.

Because every grid is directly editable, the first geometry/structural edit of a
default **forks a draft**: `createDraftLayout(columns, items)` pushes a
`{ draft: true }` layout into `layouts`, makes it active, and replaces any prior
unsaved draft. [LayoutControls](LayoutControls.tsx) then shows a prominent
"save layout?" panel (name field + Save). `saveDraft(id, name)` clears the draft
flag and names it — now it is a permanent saved layout. Switching away from an
unsaved draft (`setActiveLayout`) discards it, and `loadState()` runs
`stripDrafts()` so a draft never survives a reload unless saved.

### Editing is always on (no lock)

There is no session-only lock/unlock state. Every layout renders as the editable
free canvas; the fork-on-edit mechanism above replaces the old "unlock a named
layout" step. The masonry (content-sized, read-only) renderer still exists in
[SectionGrid](SectionGrid.tsx) but is no longer selected.

### Import / export

`exportSectionLayouts()` returns the whole persisted record;
`importSectionLayouts(state)` replaces it (used to sync layouts with a report
bundle). Both operate on the same `localStorage`-backed store.

---

## 4. Default items (initial layout generation)

Default (and any freshly generated) grids are **content-packed**: each row gets
its own height sized to fit the wrapped title + description + chart, then tiles
flow into `nCols` columns (round-robin by index, each column stacked
independently so a tall tile never clips its neighbours).

```ts
contentTileRows(rowType, cohortCount, label, tileWidthPx, spacersPx = 0): number
//   titleLines = ceil(label.length / charsPerLine(tileWidthPx))
//   px = titleLines·TILE_TITLE_LINE_PX + TILE_DESCRIPTION_PX + TILE_PADDING_PX
//        + lockedChartHeight(rowType, cohortCount, spacersPx)
//   rows = max(TILE_HEADER_ROWS, ceil((px + GRID_ROW_GAP) / GRID_ROW_HEIGHT))

buildContentLayoutItems(rows: {key, h}[], nCols): GridItem[]
//   w = floor(GRID_COLUMNS / nCols); per-column y stacking (no fixed row grid)
```

- `GRID_COLUMNS = 60` internal units, so any of 1–5 columns divides cleanly.
- `SectionCellContent` computes each row's `h` via `contentTileRows`, passing the
  tile's pixel width (`contentWidth / nCols`, `contentWidth` measured by
  [useMeasuredWidth](useResponsiveColumns.ts)) so a **long title that wraps**
  reserves the extra vertical space and the chart is never cut off.
- `tileWidthPx ≤ 0` (width not yet measured) ⇒ the title is assumed one line;
  the default rebuilds once the width is known.
- Editing a default forks a draft carrying the current items; picking a
  different default (`setActiveLayout('__default_<n>__')`) regenerates a fresh
  content-packed grid at that column count.
- `buildDefaultLayoutItems(keys, cohortCount, nCols)` (uniform height) is kept
  for the outline panel's "create layout" action.

New group tiles are placed full-width (`w = GRID_COLUMNS`) directly below all
existing content (`y = max(item.y + item.h)`), so grouping never overlaps.

---

## 5. Height / sizing

Tile heights are **derived from content**: the wrapped title, the description
line, and the row-type chart height (which scales with the cohort count).

Constants ([sectionLayoutStore.ts](sectionLayoutStore.ts)):

| Constant | Value | Role |
| --- | --- | --- |
| `GRID_ROW_HEIGHT` | `12` px | Pixels per grid row (vertical pitch). |
| `GRID_GAP` / `GRID_ROW_GAP` | `14` px | Horizontal / vertical gutter between tiles. |
| `TILE_HEADER_ROWS` | `8` | Min row span for a chart-less tile. Also the floor when shrinking. |
| `TILE_TITLE_LINE_PX` | `17` px | Height of one wrapped title line. |
| `TILE_TITLE_CHAR_PX` | `6.2` px | Approx. glyph width, for estimating title wrap. |
| `TILE_DESCRIPTION_PX` | `18` px | Reserved height for the description line. |
| `TILE_PADDING_PX` | `22` px | Fixed header + body padding (non-title, non-chart). |
| `PX_PER_COHORT` | `12` px | Boolean/numeric chart height per cohort. |
| `BOOLEAN_CHART_OVERHEAD_PX` | `120` px | Fixed overhead for boolean charts (matched to numeric so short barcharts aren't clipped). |
| `NUMERIC_EXTRA_HEIGHT_PX` | `120` px | Extra height for numeric over boolean baseline. |
| `CATEGORICAL_CHART_HEIGHT_PX` | `150` px | Fixed categorical chart height. |

```ts
lockedChartHeight(rowType, cohortCount, spacersPx = 0): number
//   categorical → CATEGORICAL_CHART_HEIGHT_PX            (fixed; ignores cohorts)
//   numeric     → cohortCount * PX_PER_COHORT + NUMERIC_EXTRA_HEIGHT_PX
//   boolean/…   → cohortCount * PX_PER_COHORT + BOOLEAN_CHART_OVERHEAD_PX + spacersPx
```

`contentTileRows` (see §4) adds the title/description chrome on top of the chart
so the *whole* tile — not just the chart — is sized to fit.

**Chart never squeezed by a tall title.** Each editable tile
(`EditableGridItem`) measures its header + description chrome and takes a
*definite* height of `max(stored h, chromeHeight + chartHeightPx)`. Because the
height is definite the chart fills it (percentage heights need a definite
parent), and a long wrapped title grows the tile **downward** instead of
stealing height from the figure.

**Default columns never overlap.** For the default views (`autoStack`), the tile
reports its measured chrome height up to `SectionGrid`, which re-stacks each
column (`restackWithChrome`): every tile is grown to its measured content height
and the tiles below it are pushed down so they sit under the one above + the
row-gap. This runs only for defaults; edited/draft layouts keep their free
(overlap-allowed) positions.

**Cohort-count changes** (`restackByHeights` in
[restackLayout.ts](restackLayout.ts)): when the cohort count changes, every tile
is resized to its **recomputed content height** for the new count (the chart
portion grows/shrinks; title/description stay), and each tile is shifted in `y`
by the summed height *delta* of the tiles above it in the same column span —
preserving the free arrangement and gaps, nothing overlapping. This is what lets
a grid **shrink back** when the selection drops from many cohorts to few.
Synthetic defaults skip this: they are rebuilt from the current count on render.

---

## 6. Positioning & resizing (editable free canvas)

Every grid is a **free canvas** (there is no lock step): each item holds an
arbitrary `(x, y)` position (in grid cells) that is dragged, resized, and saved
verbatim. Editing a synthetic default forks a draft first (see §3); thereafter
edits write straight through. All pointer handling lives in
[useGridInteraction.ts](useGridInteraction.ts): it converts pixel deltas to
cell deltas, keeps a live **draft** during the gesture, and commits **raw** on
pointer-up. There is **no collision resolution, no reflow, and no drop hints** —
items land exactly where dropped and may overlap.

### Geometry

- `cellWidth = (viewportWidth − gap·(columns−1)) / columns` — sized from the
  **card/viewport width** (`viewportWidth`, passed down from
  [ZoomableSectionGrid](ZoomableSectionGrid.tsx)), *not* the grown canvas, so
  columns keep their size as items spread out.
- `colSpan = cellWidth + gap`, `rowSpan = rowHeight`.
- A press becomes a drag only after `DRAG_THRESHOLD = 4` px of travel; below
  that it is a click (`onItemClick` / selection toggle).

### Move (drag) — free, unclamped

- `dCol = round((clientX − startX) / scale / colSpan)`,
  `dRow = round((clientY − startY) / scale / rowSpan)`.
- `x = origin.x + dCol`, `y = origin.y + dRow` — **no clamping**. Items may move
  far left/right, into **negative** coordinates, and past the old column count.

### Multi-drag — relational delta (no stack)

- Grabbing a **selected** cell drags the whole selection. Each member keeps its
  relative position and is translated by the **same** `(dCol, dRow)` delta —
  there is no animated stacked deck. Start positions are captured on
  pointer-down so the group moves rigidly.

### Resize

- `startResize(e, key, edge)` with `edge ∈ { right, bottom, corner }`.
- Width: `w = max(1, origin.w + dCol)` (no upper clamp — tiles can exceed the
  old grid width). Height: `h = max(minH, origin.h + dRow)`, floored by
  `minHMap`. No overlap cleanup afterwards.

### Canvas growth & origin

The editable grid sizes itself to the **bounding box** of all items so the
pan/zoom viewport (§12) can reach every tile:

- `originX = min(0, min itemX)`, `originY = min(0, min itemY)` — taken from the
  **committed** layout so it stays fixed *during* a drag (no mid-gesture
  reflow). Items render at `(x − originX)·colSpan, (y − originY)·rowSpan`.
- `canvasWidth = max(viewportWidth, (maxRight − originX)·colSpan − gap)`,
  `canvasHeight = (maxBottom − originY)·rowSpan − rowGap`, computed from the
  live draft so the canvas grows right/down as you drag.
- On drop the committed layout changes and the origin **renormalises**, so an
  item dragged into negative space snaps back into positive coordinates and the
  canvas widens to include it.

### Commit & persistence

On pointer-up the draft is committed **as-is** (`onLayoutChange` →
`updateLayoutItems` → `saveState` → `localStorage`, §3). A press without
movement toggles the cell's selection instead.

---

## 7. Drop hints — removed

The old swap / insert / free drop-hint system and its post-drop collision
resolution (`GridDropHint`, `DropSelectionLayout`, `cleanupGridLayout`,
`placeFreely`) have been **removed**. Drag & drop now simply writes the raw
position; overlaps are allowed. Alignment guides / snap lines could be added
later as a purely visual aid without reintroducing reflow.

---

## 8. Layout controls

[LayoutControls.tsx](LayoutControls.tsx) is the floating dropdown on a focused
section cell. It mirrors the outline panel's right-click menu.

It offers:

- **Default views** (`DEFAULT_COLUMN_OPTIONS = [1..5]`) — selecting one calls
  `setActiveLayout('__default_<n>__')`, switching to a freshly flow-packed grid
  at that column count (this replaces the old separate columns dropdown).
- **Saved layouts** — switch to, rename (`window.prompt` or double-click), or
  delete a saved layout.
- **Save panel** — shown only while a draft is active (below the dropdown):
  a name field + a Save button on a `--color-accent-bright` background with
  white text. Clicking Save or pressing Enter calls `saveDraft`. A **Cancel**
  button (or Escape) discards the draft and reverts to the default (1–5 col)
  grid it was derived from via `setActiveLayout(defaultLayoutId(columns))`.

`defaultColumns` is a *responsive* value: `useResponsiveColumns` maps the card's
measured width to a column count (breakpoints roughly 500 / 800 / 1000 / 1300
px → 1–5 columns). It seeds the `null` (responsive) default; once the user picks
an explicit default or edits, that choice sticks.

---

## 9. Component hierarchy & data flow

```
HorizontalCell (ReportViewer)
└─ SectionCellContent            ── wrapper; always grid; builds the active default (1–5 col) if no saved/draft layout is active
   └─ SectionGridContent         ── orchestrator: selection, visibility, actions; forks a draft on first edit of a default
      ├─ LayoutControls          ── default views (1–5) / saved layouts / draft "save layout?" panel
      ├─ ZoomableSectionGrid     ── pan/zoom viewport (usePanZoom + scrollbar + scrubber)
      │  └─ SectionGrid          ── chooser:
      │      ├─ MasonrySectionGrid  ──   content-sized, read-only (retained, no longer selected)
      │      └─ EditableSectionGrid ──   editable: free canvas via useGridInteraction() (always used)
      │          └─ (free-positioned tiles + resize grips)
      ├─ GroupCard               ── renders a group tile's stacked members
      │   └─ SectionRowRenderer  ── dispatches to the right chart renderer
      ├─ MultiSelectControls     ── floating toolbar (portal) for the selection
      ├─ useMultiSelectActions   ── group / change type / reset size / hide (g/t/r/h)
      └─ useGridSelection        ── selected keys + Esc / Cmd-A shortcuts (scoped to hovered section)
```

Clicking a tile toggles its selection; clicking the empty grid **background**
(`e.target === e.currentTarget` on the canvas) clears the whole selection.

State flows down from `useSectionLayouts(sectionId)`; user gestures flow back up
through `onLayoutChange` → `commitItems` → the persisted store (forking a draft
first when the active layout is a synthetic default).

---

## 10. Gesture-to-persistence lifecycle

```
pointerdown on header ─► useGridInteraction.startMove()
        │                    ├─ grabbed cell selected? → drag whole selection
        │                    └─ else                    → drag one cell
pointermove ───────────► apply same (dCol,dRow) delta → draft (no clamp)
                             canvas grows right/down to fit the draft
pointerup ─────────────► commit(draft) verbatim  (no collision / reflow)
                        onLayoutChange() → store.updateLayoutItems()
                                         → saveState() → localStorage
```

(Resize follows the same path, adjusting only the grabbed tile's w/h.)

The **entire header region** (including the title text) is the drag handle:
`SectionRowTitle` lets pointer events pass through to the header's `startMove`,
so a press-drag moves the tile, a click selects the cell, and a double-click
starts an inline rename. Only the rename `<input>` stops propagation.

---

## 11. Development notes / gotchas

- **Never key layouts by display name.** Use `getSectionLayoutId(entry)`.
- **Grid units, not pixels.** `GridItem` `x/y/w/h` are cells. Convert with
  `GRID_ROW_HEIGHT`, `GRID_COLUMNS`, `colSpan`/`rowSpan`.
- **Don't mutate store state in place.** All mutations replace objects and go
  through `update()` so `saveState`/`notify` fire.
- **Free canvas: no collision resolution.** Drag/resize commit raw positions;
  overlaps are allowed and positions (incl. negative) are persisted as-is.
- **Editing is always on** — no lock/unlock state. The first edit of a default
  view forks a session-only **draft** (`SectionLayout.draft`), surfaced by the
  "save layout?" panel; drafts are stripped on load unless saved.
- **Default views are synthetic** (`__default_<n>__`) and never stored — they are
  rebuilt from the current rows/cohort count. Only saved layouts and the live
  draft live in `layouts`.
- **Height on resize is floored by `minHMap`**; supply an accurate minimum span
  per key or tiles can be shrunk below their content.
- Persistence is best-effort: `localStorage` failures are swallowed, so don't
  rely on writes throwing on quota errors.
- **Keyboard shortcuts are section-scoped.** `Cmd/Ctrl+A`, `Esc`, and the
  editable shortcuts (`G`, `T`, `R`, `H`) only fire for the section the pointer
  is currently hovering. `SectionGridContent` passes a `containerRef` (wrapping
  `ZoomableSectionGrid`) to both `useGridSelection` and `useMultiSelectActions`;
  each handler checks `containerRef.current?.matches(':hover')` before acting.
  The wrapper div is non-positioned so the absolute viewport still fills
  `.cardContentSection` as its containing block.

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

## 13. Infinite canvas — implemented

> **Status: implemented (see §6).** The editable state is now a free canvas:
> items hold an arbitrary `(x, y)` saved in the layout, drag/resize commit raw
> (no packing / collision), items may enter negative space, and the canvas
> grows to fit. Pan/zoom (§12) moves around it.

**Two deviations from the original design below:**

1. **No `freeform` flag / no `CANVAS_UNIT_PX`.** The editable view *is* the free
   canvas; the cell unit stays **viewport-relative** (`viewportWidth / columns`)
   so initial/locked rendering is pixel-identical to before. Columns are sized
   from the card width, decoupled from the grown canvas.
2. **Negative space is supported** via a render-time origin offset
   (`originX/originY = min(0, …)`), not by forbidding it.

The masonry locked/default view is unchanged. The subsections below are kept as
the original design record.

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
