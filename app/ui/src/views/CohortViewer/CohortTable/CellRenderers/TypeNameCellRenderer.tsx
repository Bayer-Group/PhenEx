import React, { useState } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import styles from './TypeNameCellRenderer.module.css';
import typeStyles from '../../../../styles/study_types.module.css';
import { getHierarchicalBackgroundColor } from './PhenexCellRenderer';
import { formatHierarchicalIndexLabel } from './formatHierarchicalIndex';
import { CohortDataService } from '../../CohortDataService/CohortDataService';
import { PhenotypeRowActions } from './PhenotypeRowActions';
import { DeleteConfirmModal } from '../../../../components/DeleteConfirmModal/DeleteConfirmModal';
import { createEditHandler } from './cellRendererHandlers';
import ReactMarkdown from 'react-markdown';

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
const TypeNameCellRenderer: React.FC<ICellRendererParams> = props => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // ── Background / border colours (same logic as TypeSelectionDragCellRenderer) ──
  const colorBackground =
    props.data?.colorCellBackground !== undefined ? props.data.colorCellBackground : true;
  const colorBorder = props.data?.colorCellBorder !== undefined ? props.data.colorCellBorder : true;

  const backgroundColor = colorBackground
    ? getHierarchicalBackgroundColor(props.data?.effective_type, props.data?.hierarchical_index)
    : 'transparent';

  const borderColorVar =
    colorBorder && props.data?.effective_type
      ? `var(--color_${props.data.effective_type}_dim)`
      : 'transparent';

  const textColorVar = props.data?.effective_type
    ? `var(--color_${props.data.effective_type})`
    : undefined;

  const isSelected = props.node?.isSelected();
  const fontColor = typeStyles[`${props.data?.effective_type}_text_color`] || '';
  const hasChildren = !!props.data?._hasChildren;
  const childrenExpanded = !!props.data?._childrenExpanded;
  const phenotypeLevel = Math.max(0, Number(props.data?.level) || 0);

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
  const handleDirectDelete = () => {
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
    if (props.context?.toggleRowExpansion) {
      props.context.toggleRowExpansion(props.data.id);
    } else {
      CohortDataService.getInstance().toggleRowExpansion(props.data.id);
    }
  };

  const handleAddPhenotype = (type: string) => {
    if (props.context?.addPhenotype) {
      props.context.addPhenotype(type, props.data?.id ?? null);
    } else {
      CohortDataService.getInstance().addPhenotype(type, props.data?.id ?? null);
    }
  };

  // ── Indent the complete hierarchy label (caret, index, and name) ───────────────
  const getIndentationStyle = (): React.CSSProperties => {
    if (phenotypeLevel > 0) {
      return { marginLeft: `calc(var(--type-label-indent) * ${phenotypeLevel})` };
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
          color: textColorVar,
          // ...(backgroundColor ? { backgroundColor } : {}),
        }}
      >
        {/* Selection indicator bar */}
        {isSelected && <div className={styles.selectionIndicator} />}

        <div className={styles.hierarchyLabel} style={getIndentationStyle()}>
          {hasChildren ? (
            <button
              type="button"
              className={styles.accordion}
              aria-label={childrenExpanded ? 'Collapse children' : 'Expand children'}
              aria-expanded={childrenExpanded}
              onClick={handleToggleExpansion}
              onMouseDown={e => e.stopPropagation()}
            >
              <span
                className={`${styles.accordionIcon} ${childrenExpanded ? styles.accordionOpen : ''}`}
              >
                ▸
              </span>
            </button>
          ) : (
            <span className={styles.accordionSpacer} aria-hidden />
          )}

          <div
            className={styles.nameArea}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div
              className={styles.nameText}
              style={{ '--phenotype-level': phenotypeLevel } as React.CSSProperties}
            >
              <div className={styles.primaryLabel}>
                {props.data?.hierarchical_index && (
                  <span
                    className={styles.indexLabel}
                    onClick={e => {
                      e.stopPropagation();
                      handleTypeClick();
                    }}
                  >
                    {formatHierarchicalIndexLabel(props.data.hierarchical_index, phenotypeLevel)}
                  </span>
                )}
                {props.value}
              </div>
              <span className={`${styles.infoText} ${fontColor}`}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p
                        style={{
                          marginTop: 0,
                          padding: 0,
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          maxWidth: '100%',
                        }}
                      >
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ fontFamily: 'IBMPlexSans-bold', fontWeight: 700 }}>
                        {children}
                      </strong>
                    ),
                  }}
                >
                  {props.data?.description}
                </ReactMarkdown>
              </span>
            </div>

            {/* Action buttons */}
            <PhenotypeRowActions
              phenotypeId={props.data?.id ?? ''}
              isHovered={isHovered}
              isDragging={false}
              onDelete={handleDirectDelete}
              onExpand={() => handleEdit()}
              onAdd={handleAddPhenotype}
              fontColor={fontColor}
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
