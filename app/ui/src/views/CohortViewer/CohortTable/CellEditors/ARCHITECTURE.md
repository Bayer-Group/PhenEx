# Cell Editor Architecture

This document describes the architecture of complex item editors in the cohort table.

## Overview

Complex item editors allow editing of array-based or tree-based data structures within AG Grid cells. The architecture consists of:
- **Renderers**: Display items in cells and capture click events
- **Editors**: Manage editing state
- **Hooks**: Shared logic for item management
- **PhenexCellEditor**: Wrapper providing dual-panel UI (current selection + composer)

## Two Editor Patterns

### 1. Complex Item Editors (Array-Based)
For flat arrays of independent items.

**Hook**: `useComplexItemEditor`

**Editors**:
- **CodelistCellEditor** - Array of code definitions
- **ValueFilterCellEditor** - Array of value constraints
- **RelativeTimeRangeFilterCellEditor** - Array of time ranges

**Composer Components**:
- `SingleCodelistEditor`
- `SingleValueFilterEditor`
- `SingleRelativeTimeRangeEditor`

### 2. Logical Filter Editors (Tree-Based)
For hierarchical structures with logical operators (AND/OR).

**Hook**: `useLogicalFilterEditor`

**Editors**:
- **CategoricalFilterCellEditor** - Tree of categorical conditions with AND/OR
- **LogicalExpressionCellEditor** - Tree of phenotype references with AND/OR

**Composer Components**:
- `SimplifiedSingleCategoricalFilterEditor`
- `SimplifiedSingleLogicalExpressionEditor`

## PhenexCellEditor Wrapper

All editors are wrapped by `PhenexCellEditor`, which provides:

1. **Dual-Panel Interface**:
   - Current Selection Panel (mirrors cell content)
   - Composer Panel (edit individual items)

2. **Position Management**:
   - Reads `clickedItemPosition` from `node.data` (captured by renderer)
   - Positions composer at clicked item location
   - Supports dynamic position adjustment via `onRequestPositionAdjustment`

3. **Value Management**:
   - Maintains `currentValue` state
   - Exposes `getValue()` for AG Grid
   - Provides `onValueChange` callback to children

## Data Flow

### 1. Single-Click Editing Flow
```
User clicks item in cell
  ↓
Renderer captures click position (getBoundingClientRect)
  ↓
Renderer stores index + position in node.data
  ↓
Renderer calls startEditingCell
  ↓
Editor reads clickedItemIndex + clickedItemPosition from node.data
  ↓
PhenexCellEditor positions composer at clicked location
  ↓
Hook auto-selects item by clickedItemIndex
  ↓
Composer displays selected item editor
```

### 2. Value Update Flow
```
User edits item in composer
  ↓
Composer calls onValueChange
  ↓
Hook updates internal state
  ↓
Hook calls parent's onValueChange
  ↓
Editor updates currentValue
  ↓
PhenexCellEditor reflects changes in current selection panel
  ↓
User closes editor (Done button or click outside)
  ↓
AG Grid calls getValue() → returns currentValue
```

## Renderer-to-Editor Communication

**Via `node.data`**:
- `_clickedItemIndex` - Index of clicked item
- `_clickedItemPosition` - { x, y } coordinates of clicked element

**Pattern**:
```typescript
// In Renderer
const handleItemClick = (index: number, event: React.MouseEvent) => {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  props.node.data._clickedItemIndex = index;
  props.node.data._clickedItemPosition = { x: rect.left, y: rect.top };
  props.api.startEditingCell({ rowIndex, colKey });
};

// In Editor
const clickedItemIndex = props.data?._clickedItemIndex;
const clickedPosition = props.data?._clickedItemPosition;
```

## Position Adjustment

Composer editors can fine-tune their position after render:

```typescript
// In composer component
useEffect(() => {
  if (selectRef.current && onRequestPositionAdjustment) {
    requestAnimationFrame(() => {
      const selectRect = selectRef.current.getBoundingClientRect();
      const composerPanel = selectRef.current.closest('[class*="composerContainer"]');
      const composerRect = composerPanel.getBoundingClientRect();
      const offsetY = selectRect.top - composerRect.top;
      onRequestPositionAdjustment({ x: 0, y: -offsetY });
    });
  }
}, [value]); // Adjust when value changes
```

## Key Files

**Hooks**:
- `useComplexItemEditor.ts` - Array item management
- `useLogicalFilterEditor.ts` - Tree structure with logical operators

**Wrapper**:
- `PhenexCellEditor.tsx` - Dual-panel container with positioning

**Renderers** (all use `LogicalFilterRenderer` pattern):
- `CategoricalFilterCellRenderer.tsx`
- `LogicalExpressionCellRenderer.tsx`
- `CodelistCellRenderer.tsx`
- `ValueFilterCellRenderer.tsx`
- `RelativeTimeRangeCellRenderer.tsx`

**Editors**: Located in subdirectories
- `categoricalFilterEditor/`
- `logicalExpressionEditor/`
- `codelistEditor/`
- `valueFilterEditor/`
- `relativeTimeRangeEditor/`
