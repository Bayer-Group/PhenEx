# RightClickMenu Component

A generic, reusable context menu system for the application.

## Architecture

The right-click menu system consists of three parts:

1. **RightClickMenu** - The menu component itself
2. **RightClickMenuProvider** - Context provider for global menu state
3. **useRightClickMenu** - Hook to access menu functionality from any component

## Setup

Wrap your view or entire app with the provider:

```tsx
import { RightClickMenuProvider } from '@/components/RightClickMenu';

function CohortViewer() {
  return (
    <RightClickMenuProvider>
      {/* Your content */}
    </RightClickMenuProvider>
  );
}
```

## Usage Examples

### Basic Usage

```tsx
import { useRightClickMenu } from '@/components/RightClickMenu';

function MyComponent() {
  const { showMenu } = useRightClickMenu();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    showMenu({ x: e.clientX, y: e.clientY }, [
      { label: 'Copy', onClick: () => console.log('Copy') },
      { label: 'Delete', onClick: () => console.log('Delete') },
    ]);
  };

  return <div onContextMenu={handleContextMenu}>Right-click me</div>;
}
```

### AG Grid Integration

```tsx
function CohortTable() {
  const { showMenu } = useRightClickMenu();

  const onCellContextMenu = useCallback((params: CellContextMenuEvent) => {
    params.event?.preventDefault();
    const event = params.event as MouseEvent;

    const rowData = params.data;
    const columnId = params.column?.getColId();

    showMenu({ x: event.clientX, y: event.clientY }, [
      { label: `Copy ${columnId}`, onClick: () => copyCell(params) },
      { label: 'Edit Row', onClick: () => editRow(rowData) },
      { divider: true },
      { label: 'Delete Row', onClick: () => deleteRow(rowData) },
    ]);
  }, [showMenu]);

  return (
    <AgGridReact
      onCellContextMenu={onCellContextMenu}
      {/* ... other props */}
    />
  );
}
```

### Navigation Items

```tsx
function NavigationItem({ item }) {
  const { showMenu } = useRightClickMenu();

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    showMenu({ x: e.clientX, y: e.clientY }, [
      { label: 'Open', onClick: () => openItem(item) },
      { label: 'Rename', onClick: () => renameItem(item) },
      { label: 'Duplicate', onClick: () => duplicateItem(item) },
      { divider: true },
      { label: 'Delete', onClick: () => deleteItem(item) },
    ]);
  };

  return (
    <div onContextMenu={handleRightClick}>
      {item.name}
    </div>
  );
}
```

### With Disabled Items

```tsx
showMenu({ x: e.clientX, y: e.clientY }, [
  { label: 'Cut', onClick: () => cut(), disabled: !canCut },
  { label: 'Copy', onClick: () => copy() },
  { label: 'Paste', onClick: () => paste(), disabled: !clipboardHasData },
]);
```

## Menu Item Properties

```typescript
interface RightClickMenuItem {
  label: string;         // Text to display
  onClick: () => void;   // Handler when clicked
  disabled?: boolean;    // Gray out and disable click
  divider?: boolean;     // Show separator line after item
}
```

## Features

- ✅ **Contextual** - Each component provides its own menu items with access to local data
- ✅ **Generic** - No coupling to specific views or data structures
- ✅ **Smart positioning** - Automatically adjusts to stay within viewport
- ✅ **Auto-close** - Closes on outside click, ESC key, or menu item selection
- ✅ **Disabled states** - Support for disabled menu items
- ✅ **Dividers** - Visual separators between menu sections
- ✅ **Global state** - Single menu instance managed via context
- ✅ **Styled** - Uses `background_color_focus` and app color variables

## Best Practices

1. **Wrap at appropriate level** - Wrap RightClickMenuProvider at the view level, not globally
2. **Prevent default** - Always call `e.preventDefault()` in context menu handlers
3. **Pass data via closure** - Menu items capture context from where they're created
4. **Keep items simple** - For complex actions, call separate functions from onClick
5. **Use dividers** - Group related actions with divider lines
