import { FC, memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import EyeSolidIcon from '../../../../assets/icons/eye-solid.svg';
import EyeClosedIcon from '../../../../assets/icons/eye-closed.svg';
import {
  type ViewerEntry,
  STUDY_INFO_CATEGORY,
  categoryKey,
  getCategoryLabel,
  getEntryLabel,
} from '../../studyRegistryUtils';
import { OUTLINE_CATEGORY, isOutlineRow } from './outlineModel';
import styles from './OutlinePanel.module.css';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { RightClickMenu, type RightClickMenuItem } from '../../../../components/RightClickMenu/RightClickMenu';
import {
  getSectionLayoutId,
  getSectionState,
  sectionLayoutActions,
  buildDefaultLayoutItems,
  subscribeSectionLayouts,
  getHiddenKeys,
} from '../../SectionLayouts/sectionLayoutStore';

type SectionEntry = Extract<ViewerEntry, { kind: 'section' }>;

/** Eye toggle shown on hover: reflects + controls visibility of a row in the active layout. */
const RowEyeToggle: FC<{ sectionLayoutId: string; itemKey: string }> = memo(({ sectionLayoutId, itemKey }) => {
  const isHidden = useSyncExternalStore(
    subscribeSectionLayouts,
    () => getHiddenKeys(sectionLayoutId, getSectionState(sectionLayoutId).activeLayoutId).includes(itemKey),
  );
  return (
    <button
      type="button"
      className={styles.eyeBtn}
      title={isHidden ? 'Show in current layout' : 'Hide in current layout'}
      onClick={(e) => {
        e.stopPropagation();
        const { activeLayoutId } = getSectionState(sectionLayoutId);
        sectionLayoutActions.toggleItemVisibility(sectionLayoutId, activeLayoutId, itemKey);
      }}
    >
      <img src={isHidden ? EyeClosedIcon : EyeSolidIcon} alt="" className={styles.eyeIcon} />
    </button>
  );
});
RowEyeToggle.displayName = 'RowEyeToggle';

/** Dims its children when the item is hidden in the section's active layout. */
const RowHiddenDim: FC<{ sectionLayoutId: string; itemKey: string; children: React.ReactNode }> = memo(({ sectionLayoutId, itemKey, children }) => {
  const isHidden = useSyncExternalStore(
    subscribeSectionLayouts,
    () => getHiddenKeys(sectionLayoutId, getSectionState(sectionLayoutId).activeLayoutId).includes(itemKey),
  );
  return <span className={`${styles.itemSpanWrapper}${isHidden ? ` ${styles.labelHidden}` : ''}`}>{children}</span>;
});
RowHiddenDim.displayName = 'RowHiddenDim';

interface OutlinePanelProps {
  /** The exact list of navigable cells currently in the viewer. */
  entries: ViewerEntry[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  /** Accordion keys (section / sectionless-category) that are expanded. */
  expandedKeys: Set<string>;
  onToggleExpand: (key: string) => void;
  /** Move a phenotype into `targetSectionId`, before `beforeName` (or append). */
  onMovePhenotype: (name: string, targetSectionId: string, beforeName: string | null) => void;
  /** Set a phenotype's editable display label. */
  onRenamePhenotype: (name: string, displayName: string) => void;
  /** Set a section's editable display label. */
  onRenameSection: (sectionId: string, displayName: string) => void;
}

/** Which item (if any) is being renamed inline. */
type Renaming = { kind: 'section' | 'row'; id: string };

/** Context-menu target. */
type Menu =
  | { x: number; y: number; kind: 'row'; id: string }
  | { x: number; y: number; kind: 'section'; id: string; entry: SectionEntry };

/** A small auto-focusing inline text input used for renaming. */
const InlineEdit: FC<{ value: string; onCommit: (v: string) => void; onCancel: () => void }> = ({
  value,
  onCommit,
  onCancel,
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    const next = ref.current?.value.trim() ?? '';
    if (next && next !== value) onCommit(next);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      className={styles.renameInput}
      defaultValue={value}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={commit}
    />
  );
};

/**
 * An accordion outline whose items map 1:1 to the cells the user can scroll
 * through. Baseline-characteristics phenotypes are editable: they can be
 * dragged between sections, and both sections and phenotypes can be renamed via
 * a right-click menu (inline text field).
 */
export const OutlinePanel: FC<OutlinePanelProps> = ({
  entries,
  currentIndex,
  onNavigate,
  expandedKeys,
  onToggleExpand,
  onMovePhenotype,
  onRenamePhenotype,
  onRenameSection,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragName, setDragName] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; pos: 'before' | 'after' | 'into' } | null>(null);
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);

  /** Maps each row.name to the sectionLayoutId of its parent section. */
  const rowSectionMap = useMemo(() => {
    const map = new Map<string, string>();
    let currentSectionLayoutId: string | null = null;
    for (const entry of entries) {
      if (entry.kind === 'section') currentSectionLayoutId = getSectionLayoutId(entry);
      else if (entry.kind === 'row' && currentSectionLayoutId) map.set(entry.row.name, currentSectionLayoutId);
    }
    return map;
  }, [entries]);

  const clearDrag = () => {
    setDragName(null);
    setDropTarget(null);
  };

  /** The next visible phenotype in the same section, or null if last. */
  const nextRowNameInSection = (entry: Extract<ViewerEntry, { kind: 'row' }>): string | null => {
    const next = entries[entry.index + 1];
    return next && next.kind === 'row' && next.row.sectionId === entry.row.sectionId ? next.row.name : null;
  };

  /** Build the right-click menu items for a section: layout switching + rename. */
  const buildSectionMenuItems = (menu: Extract<Menu, { kind: 'section' }>): RightClickMenuItem[] => {
    const { entry } = menu;
    const sectionLayoutId = getSectionLayoutId(entry);
    const { layouts, activeLayoutId } = getSectionState(sectionLayoutId);

    const layoutItems: RightClickMenuItem[] = [
      {
        label: `${activeLayoutId === null ? '● ' : '   '}List`,
        onClick: () => { sectionLayoutActions.setActiveLayout(sectionLayoutId, null); setMenu(null); },
      },
      ...layouts.map((l): RightClickMenuItem => ({
        label: `${activeLayoutId === l.id ? '● ' : '   '}${l.name}`,
        onClick: () => { sectionLayoutActions.setActiveLayout(sectionLayoutId, l.id); setMenu(null); },
        submenu: [
          {
            label: 'Switch to',
            onClick: () => { sectionLayoutActions.setActiveLayout(sectionLayoutId, l.id); setMenu(null); },
          },
          {
            label: 'Rename…',
            onClick: () => {
              const name = window.prompt('Layout name', l.name)?.trim();
              if (name) sectionLayoutActions.renameLayout(sectionLayoutId, l.id, name);
              setMenu(null);
            },
          },
          {
            label: 'Delete',
            onClick: () => { sectionLayoutActions.deleteLayout(sectionLayoutId, l.id); setMenu(null); },
          },
        ],
      })),
      {
        label: '＋ New grid layout',
        divider: true,
        onClick: () => {
          const keys = entry.rows.map((r) => r.name);
          const name = `Grid ${layouts.length + 1}`;
          sectionLayoutActions.createLayout(sectionLayoutId, name, buildDefaultLayoutItems(keys));
          setMenu(null);
        },
      },
    ];

    const renameItem: RightClickMenuItem[] = entry.sectionId
      ? [{
          label: 'Rename section',
          onClick: () => { if (entry.sectionId) setRenaming({ kind: 'section', id: entry.sectionId }); },
        }]
      : [];

    return [...layoutItems, ...renameItem];
  };

  const openSectionMenu = (e: React.MouseEvent, entry: SectionEntry) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, kind: 'section', id: getSectionLayoutId(entry), entry });
  };


  const renderChevron = (toggleKey: string | null, isExpanded: boolean) =>
    toggleKey ? (
      <button
        type="button"
        className={styles.chevron}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
        onClick={() => onToggleExpand(toggleKey)}
      >
        <span className={`${styles.chevronIcon} ${isExpanded ? styles.chevronOpen : ''}`}>▸</span>
      </button>
    ) : (
      <span className={styles.chevronSpacer} />
    );

  const renderLabel = (
    label: string,
    level: number,
    entryIndex: number,
    isActive: boolean,
    editing: boolean,
    onCommit: (v: string) => void,
    onContextMenu?: (e: React.MouseEvent) => void,
  ) => {
    if (editing) {
      return <InlineEdit value={label} onCommit={onCommit} onCancel={() => setRenaming(null)} />;
    }
    return (
      <button
        type="button"
        className={`${styles.item} ${isActive ? styles.itemActive : ''} ${styles[`level${level}`] ?? ''}`}
        onClick={() => onNavigate(entryIndex)}
        onContextMenu={onContextMenu}
      >
        {label}
      </button>
    );
  };

  const renderPlainItem = (
    key: string,
    label: string,
    level: number,
    entryIndex: number,
    toggleKey: string | null,
    onContextMenu?: (e: React.MouseEvent) => void,
    eyeConfig?: { sectionLayoutId: string; itemKey: string },
  ) => {
    const isActive = currentIndex === entryIndex;
    const isExpanded = toggleKey ? expandedKeys.has(toggleKey) : false;
    return (
      <div
        key={key}
        className={styles.row}
        style={{ paddingLeft: level * 8 }}
        onMouseEnter={eyeConfig ? () => setHoveredRowKey(eyeConfig.itemKey) : undefined}
        onMouseLeave={eyeConfig ? () => setHoveredRowKey(null) : undefined}
      >
        {renderChevron(toggleKey, isExpanded)}
        {eyeConfig
          ? <RowHiddenDim sectionLayoutId={eyeConfig.sectionLayoutId} itemKey={eyeConfig.itemKey}>{renderLabel(label, level, entryIndex, isActive, false, () => {}, onContextMenu)}</RowHiddenDim>
          : renderLabel(label, level, entryIndex, isActive, false, () => {}, onContextMenu)
        }
        {eyeConfig && hoveredRowKey === eyeConfig.itemKey && (
          <RowEyeToggle sectionLayoutId={eyeConfig.sectionLayoutId} itemKey={eyeConfig.itemKey} />
        )}
      </div>
    );
  };

  const renderEditableSection = (
    entry: Extract<ViewerEntry, { kind: 'section' }>,
    toggleKey: string | null,
  ) => {
    const isActive = currentIndex === entry.index;
    const isExpanded = toggleKey ? expandedKeys.has(toggleKey) : false;
    const sectionId = entry.sectionId;
    const editing = renaming?.kind === 'section' && renaming.id === sectionId;
    const isDropTarget = dragName != null && dropTarget?.key === entry.key;
    return (
      <div
        key={entry.key}
        className={`${styles.row} ${isDropTarget ? styles.dropInto : ''}`}
        style={{ paddingLeft: 8 }}
        onDragOver={sectionId ? (e) => { e.preventDefault(); setDropTarget({ key: entry.key, pos: 'into' }); } : undefined}
        onDrop={sectionId ? (e) => {
          e.preventDefault();
          if (dragName) onMovePhenotype(dragName, sectionId, null);
          clearDrag();
        } : undefined}
      >
        {renderChevron(toggleKey, isExpanded)}
        {renderLabel(
          entry.section,
          1,
          entry.index,
          isActive,
          !!editing,
          (v) => { if (sectionId) onRenameSection(sectionId, v); setRenaming(null); },
          (e) => openSectionMenu(e, entry),
        )}
      </div>
    );
  };

  const renderEditableRow = (entry: Extract<ViewerEntry, { kind: 'row' }>) => {
    const { row } = entry;
    const isActive = currentIndex === entry.index;
    const editing = renaming?.kind === 'row' && renaming.id === row.name;
    const isTarget = dragName != null && dragName !== row.name && dropTarget?.key === entry.key;
    const dropClass = isTarget ? (dropTarget!.pos === 'after' ? styles.dropAfter : styles.dropBefore) : '';
    const sectionLayoutId = rowSectionMap.get(row.name);
    return (
      <div
        key={entry.key}
        className={`${styles.row} ${styles.rowDraggable} ${dropClass}`}
        style={{ paddingLeft: 16 }}
        draggable={!editing}
        onMouseEnter={() => setHoveredRowKey(row.name)}
        onMouseLeave={() => setHoveredRowKey(null)}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          const btn = e.currentTarget.querySelector('button');
          if (btn) {
            btn.classList.add(styles.dragImage);
            const rect = btn.getBoundingClientRect();
            e.dataTransfer.setDragImage(btn, e.clientX - rect.left, e.clientY - rect.top);
            setTimeout(() => btn.classList.remove(styles.dragImage), 0);
          }
          setDragName(row.name);
        }}
        onDragEnd={clearDrag}
        onDragOver={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
          setDropTarget({ key: entry.key, pos });
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragName && dragName !== row.name && row.sectionId) {
            const pos = dropTarget?.key === entry.key ? dropTarget.pos : 'before';
            const beforeName = pos === 'after' ? nextRowNameInSection(entry) : row.name;
            if (beforeName !== dragName) onMovePhenotype(dragName, row.sectionId, beforeName);
          }
          clearDrag();
        }}
      >
        <span className={styles.chevronSpacer} />
        {sectionLayoutId
          ? <RowHiddenDim sectionLayoutId={sectionLayoutId} itemKey={row.name}>{renderLabel(
              getEntryLabel(entry), 2, entry.index, isActive, editing,
              (v) => { onRenamePhenotype(row.name, v); setRenaming(null); },
              (e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, kind: 'row', id: row.name }); },
            )}</RowHiddenDim>
          : renderLabel(
              getEntryLabel(entry), 2, entry.index, isActive, editing,
              (v) => { onRenamePhenotype(row.name, v); setRenaming(null); },
              (e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, kind: 'row', id: row.name }); },
            )
        }
        {hoveredRowKey === row.name && sectionLayoutId && (
          <RowEyeToggle sectionLayoutId={sectionLayoutId} itemKey={row.name} />
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <div ref={scrollRef} className={styles.scrollContent}>
        {entries.map((entry) => {
          if (entry.kind === 'category') {
            return renderPlainItem(
              entry.key,
              getCategoryLabel(entry.category),
              0,
              entry.index,
              entry.hasSectionlessRows ? categoryKey(entry.category) : null,
            );
          }
          if (entry.kind === 'section') {
            const toggleKey = entry.rows.length >= 1 ? entry.key : null;
            return entry.category === OUTLINE_CATEGORY
              ? renderEditableSection(entry, toggleKey)
              : renderPlainItem(entry.key, entry.section, 1, entry.index, toggleKey, (e) => openSectionMenu(e, entry));
          }
          // Individual rows: only appear when their parent is expanded. The
          // study_info intro cell has no outline entry.
          if (entry.row.category === STUDY_INFO_CATEGORY) return null;
          return isOutlineRow(entry.row)
            ? renderEditableRow(entry)
            : renderPlainItem(
                entry.key,
                getEntryLabel(entry),
                2,
                entry.index,
                null,
                undefined,
                rowSectionMap.has(entry.row.name)
                  ? { sectionLayoutId: rowSectionMap.get(entry.row.name)!, itemKey: entry.row.name }
                  : undefined,
              );
        })}
      </div>

      {menu && (
        <RightClickMenu
          position={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
          items={
            menu.kind === 'section'
              ? buildSectionMenuItems(menu)
              : [
                  {
                    label: 'Rename',
                    onClick: () => setRenaming({ kind: menu.kind, id: menu.id }),
                  },
                ]
          }
        />
      )}

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
  );
};

