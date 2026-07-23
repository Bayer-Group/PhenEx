import React, { useState, useRef } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './TypeNameCellRenderer.module.css';
import typeStyles from '../../../../styles/study_types.module.css';
import { getHierarchicalBackgroundColor } from './PhenexCellRenderer';
import { TypeRenderer } from './actualRendering/TypeRenderer';
import ArrowUpRightIcon from '../../../../components/icons/ArrowUpRightIcon';
import { CohortDataService } from '../../CohortDataService/CohortDataService';
import { DeleteConfirmModal } from '../../../../components/DeleteConfirmModal/DeleteConfirmModal';
import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
import ReactMarkdown from 'react-markdown';

const TYPE_WIDGET_WIDTH = 40;

/**
 * TypeNameCellRenderer
 *
 * Combines the type-selector / row-drag widget (left, fixed width) with the
 * name + description content (right, fills remaining space) into a single
 * AG Grid cell.
 *
 * Editing behaviour:
 *  - Click the type widget  → opens TypeSelectorCellEditor  (eventKey: 'type')
 *  - Double-click name area → opens NameCellEditor           (default)
 *  - Click settings arrow   → opens SettingsCellEditor       (eventKey: 'settings')
 *  - Click accordion chevron → expand/collapse component children for this row
 */
const TypeNameCellRenderer: React.FC<ICellRendererParams> = (props) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);

  // ── Background / border colours (same logic as TypeSelectionDragCellRenderer) ──
  const colorBackground =
    props.data?.colorCellBackground !== undefined ? props.data.colorCellBackground : true;
  const colorBorder =
    props.data?.colorCellBorder !== undefined ? props.data.colorCellBorder : true;

  const backgroundColor = colorBackground
    ? getHierarchicalBackgroundColor(props.data?.effective_type, props.data?.hierarchical_index)
    : 'transparent';

  const borderColorVar =
    colorBorder && props.data?.effective_type
      ? `var(--color_${props.data.effective_type}_dim)`
      : 'transparent';

  const isSelected = props.node?.isSelected();
  const fontColor = typeStyles[`${props.data?.effective_type}_text_color`] || '';
  const hasChildren = !!props.data?._hasChildren;
  const childrenExpanded = !!props.data?._childrenExpanded;

  // ── Drag ghost image ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent) => {
    if (deleteButtonRef.current) deleteButtonRef.current.style.opacity = '0';
    setIsDragging(true);
    if (labelContainerRef.current) {
      const clone = labelContainerRef.current.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('button').forEach(btn => ((btn as HTMLElement).style.opacity = '0'));
      clone.style.position = 'fixed';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.width = `${labelContainerRef.current.offsetWidth}px`;
      document.body.appendChild(clone);
      e.dataTransfer.setDragImage(clone, 20, 10);
      requestAnimationFrame(() => document.body.removeChild(clone));
    }
  };

  // ── Type widget click → open TypeSelectorCellEditor ──────────────────────────
  const handleTypeClick = () => {
    if (!props.node || !props.column || props.node.rowIndex === null) return;
    if (props.data?.type === 'component') return; // components are not editable
    props.api?.startEditingCell({
      rowIndex: props.node.rowIndex,
      colKey: props.column.getColId(),
      eventKey: 'type',
    });
  };

  // ── Settings arrow click → open SettingsCellEditor ───────────────────────────
  const handleEdit = createEditHandler(props);
  const handleDelete = createDeleteHandler(props);

  const handleDirectDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!props.data?.id) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    if (!props.data?.id) return;
    if (props.context?.deletePhenotype) {
      props.context.deletePhenotype(props.data.id);
    } else {
      CohortDataService.getInstance().deletePhenotype(props.data.id);
    }
  };

  const handleToggleExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!props.data?.id) return;
    CohortDataService.getInstance().toggleRowExpansion(props.data.id);
  };

  // ── Name indentation (component phenotypes) ───────────────────────────────────
  const getIndentationStyle = (): React.CSSProperties => {
    if (props.data?.type === 'component' && props.data.level > 0) {
      return { marginLeft: `calc(var(--type-label-indent) * ${props.data.level})` };
    }
    return {};
  };

  return (
    <>
      <div
        className={styles.outerContainer}
        style={{
          borderTopColor: borderColorVar,
          borderLeft: `1px solid ${borderColorVar}`,
          ...(backgroundColor ? { backgroundColor } : {}),
        }}
      >
        {/* Selection indicator bar */}
        {isSelected && <div className={styles.selectionIndicator} />}

        {/* Accordion: right of selection bar, left of index label */}
        {hasChildren ? (
          <button
            type="button"
            className={styles.accordion}
            aria-label={childrenExpanded ? 'Collapse children' : 'Expand children'}
            aria-expanded={childrenExpanded}
            onClick={handleToggleExpansion}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className={`${styles.accordionIcon} ${childrenExpanded ? styles.accordionOpen : ''}`}>
              ▸
            </span>
          </button>
        ) : (
          <span className={styles.accordionSpacer} aria-hidden />
        )}

        {/* ── Left: type/drag widget ─────────────────────────────────────────── */}
        <div className={styles.typeWidget} style={{ width: TYPE_WIDGET_WIDTH }}>
          {/* <div className={styles.dragHandle} data-drag-handle="true">⠿</div> */}
          <TypeRenderer value={props.data?.type} data={props.data} onClick={handleTypeClick} />
        </div>

        {/* ── Right: name + description ──────────────────────────────────────── */}
        <div
          ref={labelContainerRef}
          className={styles.nameArea}
          style={getIndentationStyle()}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onDragStart={handleDragStart}
          onDragEnd={() => {
            if (deleteButtonRef.current) deleteButtonRef.current.style.opacity = '';
            setIsDragging(false);
          }}
        >
          <div className={styles.nameText}>
            {props.value}
            <span className={`${styles.infoText} ${fontColor}`}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p style={{ marginTop: 0, padding: 0, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>
                      {children}
                    </p>
                  ),
                }}
              >
                {props.data?.description}
              </ReactMarkdown>
            </span>
          </div>

          {/* Action buttons */}
          <div className={styles.actions}>
            <button
              ref={deleteButtonRef}
              className={`${styles.deleteButton} ${fontColor}`}
              onClick={handleDirectDelete}
              title="Delete phenotype"
              style={{ opacity: isHovered && !isDragging ? 1 : 0, pointerEvents: isHovered && !isDragging ? 'auto' : 'none' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
            <ArrowUpRightIcon
              className={`${styles.expandArrow} ${isSelected ? styles.expandArrowSelected : ''} ${fontColor}`}
              onClick={(e: React.MouseEvent<SVGSVGElement>) => {
                e.stopPropagation();
                handleEdit();
              }}
            />
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          name={props.data?.name || ''}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
};

export default TypeNameCellRenderer;
