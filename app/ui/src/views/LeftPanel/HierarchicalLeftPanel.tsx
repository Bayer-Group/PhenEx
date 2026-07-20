import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { LeftPanel } from './LeftPanel';
import styles from './HierarchicalLeftPanel.module.css';
import { UserLogin } from './UserLogin/UserLogin';
import {
  HierarchicalLeftPanelDataService,
  HierarchicalTreeNode,
  type PanelError,
} from './HierarchicalLeftPanelDataService';
import { MainViewService, ViewInfo } from '../MainView/MainView';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { RightClickMenu, type RightClickMenuItem } from '../../components/RightClickMenu/RightClickMenu';
import { TreeNodeAddButton } from '../../components/ButtonsAndTabs/TreeNodeAddButton/TreeNodeAddButton';

interface HierarchicalLeftPanelProps {
  isVisible: boolean;
}

/** The three depths of the navigation tree. */
type RowKind = 'category' | 'study' | 'cohort';

/** A single visible row, produced by flattening the tree against the expanded set. */
interface FlatRow {
  kind: RowKind;
  node: HierarchicalTreeNode;
  level: number;
  /** Reorder group: the category id for studies, the study id for cohorts, '' for categories. */
  parentId: string;
  /** Root category ('mystudies' | 'publicstudies') this row descends from. */
  categoryId: string;
  hasChildren: boolean;
  /** Public rows cannot be renamed. */
  isPublic: boolean;
}

/** Which row (if any) is being renamed inline. */
type Renaming = { kind: RowKind; id: string };

/** Context-menu target. */
type Menu = { x: number; y: number; row: FlatRow };

/** Where a drag is currently hovering relative to a target row. */
type DropTarget = { id: string; pos: 'before' | 'after' };

/** An auto-focusing inline text input used for renaming (mirrors the OutlinePanel pattern). */
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

/** Flatten the tree into the rows that are currently visible given `expanded`. */
const buildRows = (tree: HierarchicalTreeNode[], expanded: Set<string>): FlatRow[] => {
  const rows: FlatRow[] = [];
  for (const category of tree) {
    const isPublic = category.id === 'publicstudies';
    const studies = category.children ?? [];
    rows.push({
      kind: 'category',
      node: category,
      level: 0,
      parentId: '',
      categoryId: category.id,
      hasChildren: studies.length > 0,
      isPublic,
    });
    if (!expanded.has(category.id)) continue;

    for (const study of studies) {
      const cohorts = study.children ?? [];
      rows.push({
        kind: 'study',
        node: study,
        level: 1,
        parentId: category.id,
        categoryId: category.id,
        hasChildren: cohorts.length > 0,
        isPublic,
      });
      if (!expanded.has(study.id)) continue;

      for (const cohort of cohorts) {
        rows.push({
          kind: 'cohort',
          node: cohort,
          level: 2,
          parentId: study.id,
          categoryId: category.id,
          hasChildren: false,
          isPublic,
        });
      }
    }
  }
  return rows;
};

/**
 * Convert a "drop before `beforeId`" gesture into the index expected by the data
 * service's reorder methods (which splice the dragged id out first, then insert).
 */
const computeReorderIndex = (siblingIds: string[], draggedId: string, beforeId: string | null): number => {
  const from = siblingIds.indexOf(draggedId);
  const to = beforeId ? siblingIds.indexOf(beforeId) : siblingIds.length;
  return from < to ? to - 1 : to;
};

/**
 * Left-panel study/cohort navigation tree.
 *
 * Reimplemented with the OutlinePanel interaction pattern — plain rows with
 * native HTML5 drag-and-drop, inline rename, chevron expand/collapse and a
 * right-click context menu — replacing the previous react-complex-tree tree.
 */
export const HierarchicalLeftPanel: FC<HierarchicalLeftPanelProps> = ({ isVisible }) => {
  const dataService = useRef(HierarchicalLeftPanelDataService.getInstance());
  const [treeData, setTreeData] = useState<HierarchicalTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['mystudies', 'publicstudies']));
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragRow, setDragRow] = useState<FlatRow | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [programmaticSelection, setProgrammaticSelection] = useState<string | null>(null);
  const [error, setError] = useState<PanelError | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { studyId, cohortId } = useParams();
  const location = useLocation();

  // Subscribe to tree data changes.
  useEffect(() => {
    const update = () => setTreeData([...dataService.current.getTreeData()]);
    update();
    dataService.current.addListener(update);
    return () => dataService.current.removeListener(update);
  }, []);

  // Surface background-persistence failures as a dismissible, retryable toast.
  useEffect(() => {
    const service = dataService.current;
    const handle = (err: PanelError) => setError(err);
    service.addErrorListener(handle);
    return () => service.removeErrorListener(handle);
  }, []);

  // Auto-expand the category + study for the current URL.
  useEffect(() => {
    if (!studyId) return;
    const categoryId = dataService.current.isPublicStudy(studyId) ? 'publicstudies' : 'mystudies';
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(categoryId);
      next.add(studyId);
      return next;
    });
  }, [studyId, cohortId, location.pathname]);

  // Selection follows the URL; fall back to programmatic navigation events.
  useEffect(() => {
    const service = MainViewService.getInstance();
    const handle = (viewInfo: ViewInfo) => {
      const data = viewInfo.data;
      const id = typeof data === 'string' ? data : data?.id;
      if (id) setProgrammaticSelection(id);
    };
    service.addListener(handle);
    return () => service.removeListener(handle);
  }, []);

  const selectedId = cohortId ?? studyId ?? programmaticSelection;

  const rows = useMemo(() => buildRows(treeData, expanded), [treeData, expanded]);

  /** Ordered ids of the drag siblings (same parent + kind) that are currently visible. */
  const siblingIdsFor = (row: FlatRow): string[] =>
    rows.filter((r) => r.kind === row.kind && r.parentId === row.parentId).map((r) => r.node.id);

  const nextSiblingId = (row: FlatRow): string | null => {
    const siblings = siblingIdsFor(row);
    const i = siblings.indexOf(row.node.id);
    return i >= 0 && i < siblings.length - 1 ? siblings[i + 1] : null;
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const navigateToRow = (row: FlatRow) => {
    dataService.current.selectNode(row.node.id);
    if (row.kind === 'category') {
      navigate('/studies');
    } else if (row.kind === 'study') {
      navigate(`/studies/${row.node.id}`);
    } else {
      const data = row.node.viewInfo?.data as { study_id?: string } | undefined;
      const parentStudyId = (data && data.study_id) || row.parentId;
      navigate(`/studies/${parentStudyId}/cohorts/${row.node.id}`);
    }
  };

  const handleAddStudy = () => void dataService.current.addNewStudy();
  const handleAddCohort = (studyId: string) => void dataService.current.addNewCohortToStudy({ id: studyId });

  const commitRename = (row: FlatRow, name: string) => {
    if (row.kind === 'study') dataService.current.updateStudyName(row.node.id, name);
    else if (row.kind === 'cohort') dataService.current.updateCohortName(row.node.id, name);
    setRenaming(null);
  };

  const clearDrag = () => {
    setDragRow(null);
    setDropTarget(null);
  };

  const handleDrop = (target: FlatRow) => {
    if (!dragRow || dragRow.kind === 'category') return clearDrag();
    // Only reorder within the same group and level.
    if (dragRow.kind !== target.kind || dragRow.parentId !== target.parentId) return clearDrag();

    const pos = dropTarget?.id === target.node.id ? dropTarget.pos : 'before';
    const beforeId = pos === 'after' ? nextSiblingId(target) : target.node.id;
    if (beforeId === dragRow.node.id) return clearDrag();

    const siblings = siblingIdsFor(dragRow);
    const index = computeReorderIndex(siblings, dragRow.node.id, beforeId);
    if (dragRow.kind === 'study') dataService.current.reorderStudy(dragRow.categoryId, dragRow.node.id, index);
    else dataService.current.reorderCohort(dragRow.parentId, dragRow.node.id, index);
    clearDrag();
  };

  // ── Row builders ────────────────────────────────────────────────────
  const renderChevron = (row: FlatRow) =>
    row.hasChildren ? (
      <button
        type="button"
        className={styles.chevron}
        aria-label={expanded.has(row.node.id) ? 'Collapse' : 'Expand'}
        onClick={(e) => {
          e.stopPropagation();
          toggleExpand(row.node.id);
        }}
      >
        <span className={`${styles.chevronIcon} ${expanded.has(row.node.id) ? styles.chevronOpen : ''}`}>▸</span>
      </button>
    ) : (
      <span className={styles.chevronSpacer} />
    );

  const renderAddButton = (row: FlatRow) => {
    if (hoveredId !== row.node.id) return null;
    if (row.kind === 'category' && row.categoryId === 'mystudies') {
      return <TreeNodeAddButton alwaysVisible tooltipText="Create a new study" onClick={handleAddStudy} />;
    }
    if (row.kind === 'study' && !row.isPublic) {
      return (
        <TreeNodeAddButton
          alwaysVisible
          tooltipText="Create a new cohort"
          onClick={() => handleAddCohort(row.node.id)}
        />
      );
    }
    return null;
  };

  const renderRow = (row: FlatRow) => {
    const { node } = row;
    const isSelected = selectedId === node.id;
    const editing = renaming?.kind === row.kind && renaming.id === node.id;
    const canRename = row.kind === 'cohort' || (row.kind === 'study' && !row.isPublic);
    const canDrag = (row.kind === 'study' || row.kind === 'cohort') && !editing;
    const isDropTarget = dragRow != null && dragRow.node.id !== node.id && dropTarget?.id === node.id;
    const dropClass = isDropTarget ? (dropTarget!.pos === 'after' ? styles.dropAfter : styles.dropBefore) : '';

    return (
      <div
        key={`${row.kind}:${node.id}`}
        className={`${styles.row} ${canDrag ? styles.rowDraggable : ''} ${dropClass}`}
        style={{ paddingLeft: row.level * 12 }}
        draggable={canDrag}
        onMouseEnter={() => setHoveredId(node.id)}
        onMouseLeave={() => setHoveredId((cur) => (cur === node.id ? null : cur))}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, row });
        }}
        onDragStart={(e) => {
          if (!canDrag) return;
          e.dataTransfer.effectAllowed = 'move';
          const btn = e.currentTarget.querySelector(`.${styles.item}`) as HTMLElement | null;
          if (btn) {
            btn.classList.add(styles.dragImage);
            const rect = btn.getBoundingClientRect();
            e.dataTransfer.setDragImage(btn, e.clientX - rect.left, e.clientY - rect.top);
            setTimeout(() => btn.classList.remove(styles.dragImage), 0);
          }
          setDragRow(row);
        }}
        onDragEnd={clearDrag}
        onDragOver={(e) => {
          if (!dragRow || dragRow.kind !== row.kind || dragRow.parentId !== row.parentId) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
          setDropTarget({ id: node.id, pos });
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(row);
        }}
      >
        {renderChevron(row)}
        {editing ? (
          <InlineEdit
            value={node.displayName ?? ''}
            onCommit={(v) => commitRename(row, v)}
            onCancel={() => setRenaming(null)}
          />
        ) : (
          <button
            type="button"
            className={`${styles.item} ${styles[`level${row.level}`] ?? ''} ${isSelected ? styles.itemActive : ''}`}
            onClick={() => {
              if (row.kind === 'study' && isSelected) {
                toggleExpand(node.id);
              } else {
                navigateToRow(row);
              }
            }}
            onDoubleClick={() => canRename && setRenaming({ kind: row.kind, id: node.id })}
          >
            {node.displayName}
          </button>
        )}
        {renderAddButton(row)}
      </div>
    );
  };

  const buildMenuItems = (row: FlatRow): RightClickMenuItem[] => {
    const canRename = row.kind === 'cohort' || (row.kind === 'study' && !row.isPublic);
    const items: RightClickMenuItem[] = [{ label: 'Open', onClick: () => navigateToRow(row) }];
    if (canRename) {
      items.push({ label: 'Rename', onClick: () => setRenaming({ kind: row.kind, id: row.node.id }) });
    }
    if (row.kind === 'study' && !row.isPublic) {
      items.push({ label: 'New cohort', onClick: () => handleAddCohort(row.node.id) });
    }
    if (row.kind === 'category' && row.categoryId === 'mystudies') {
      items.push({ label: 'New study', onClick: handleAddStudy });
    }
    return items;
  };

  const isHome = location.pathname === '/';

  return (
    <LeftPanel isVisible={isVisible} width={280}>
      <div className={styles.panel}>
        <button
          type="button"
          className={`${styles.homeButton} ${isHome ? styles.homeButtonActive : ''}`}
          onClick={() => navigate('/')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
            <polyline points="9 21 9 12 15 12 15 21" />
          </svg>
          Home
        </button>
        <div ref={scrollRef} className={styles.scrollContent}>
          {rows.map(renderRow)}
        </div>

        {menu && (
          <RightClickMenu
            position={{ x: menu.x, y: menu.y }}
            onClose={() => setMenu(null)}
            items={buildMenuItems(menu.row)}
          />
        )}

        <div className={styles.userLoginFooter}>
          <UserLogin />
        </div>

        {error && (
          <div className={styles.errorToast} role="alert">
            <span className={styles.errorToastMessage}>{error.message}</span>
            <button
              type="button"
              className={styles.errorToastRetry}
              onClick={() => {
                const retry = error.retry;
                setError(null);
                retry();
              }}
            >
              Retry
            </button>
            <button
              type="button"
              className={styles.errorToastDismiss}
              aria-label="Dismiss"
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className={styles.scrollbarRegion}>
          <SimpleCustomScrollbar
            targetRef={scrollRef}
            orientation="vertical"
            marginTop={10}
            marginBottom={20}
            marginToEnd={3}
            classNameTrack={styles.scrollBarTrack}
            classNameThumb={styles.scrollBarThumb}
            showOnHover={true}
          />
        </div>
      </div>
    </LeftPanel>
  );
};
