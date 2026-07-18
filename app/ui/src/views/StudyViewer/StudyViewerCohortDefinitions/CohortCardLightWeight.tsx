import React, { useCallback, useMemo, useRef, useState } from 'react';
import styles from './CohortCardLightWeight.module.css';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { CohortCardActions } from './CohortCardActions';
import { TwoPanelCohortViewerService } from '../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { CohortViewType } from '../../CohortViewer/CohortViewer';
import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';
import { RightClickMenuItem } from '../../../components/RightClickMenu/RightClickMenu';
import { ScaledRightClickMenu } from '../../../components/RightClickMenu/ScaledRightClickMenu';
import { useReportMode } from '../../../contexts/ReportModeContext';
import { CohortDefinitionReportD3, CohortDefinitionReportD3Ref } from './CohortDefinitionReportD3';
import { CohortCardViewer } from '../../CohortViewer/CohortCardViewer/CohortCardViewer';
import { defaultColumns } from '../../CohortViewer/CohortDataService/CohortColumnDefinitions';

interface CohortCardLightWeightProps {
  cohortDef: CohortWithTableData;
  cohortId: string;
  studyDataService: any;
  onCardClick: (cohortDef: CohortWithTableData) => void;
  isDragging: boolean;
  isScrolling: boolean;
  isShiftPressed: boolean;
  isCommandPressed: boolean;
  onDeleteCohort?: (cohortDef: CohortWithTableData) => void;
  /** Legacy prop retained for the CohortGroupView pass-through; the card now
   *  routes cell edits through the study data service directly. */
  onCellValueChanged?: (cohortId: string, rowIndex: number, field: string, value: any) => Promise<void>;
}

export const CohortCardLightWeight: React.FC<CohortCardLightWeightProps> = React.memo(({
  cohortDef,
  cohortId,
  studyDataService,
  onCardClick,
  isDragging,
  isScrolling,
  isShiftPressed,
  isCommandPressed,
  onDeleteCohort,
}) => {
  const { isReportMode } = useReportMode();
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveringActions, setIsHoveringActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const d3ReportRef = useRef<CohortDefinitionReportD3Ref>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const initialPositionSetRef = useRef(false);
  const [rightClickMenu, setRightClickMenu] = useState<{ position: { x: number; y: number }; rowIndex: number | null } | null>(null);

  const definitionService = studyDataService.cohort_definitions_service;
  const rows = cohortDef.table_data.rows;

  // The card renders the same columns as the two-panel viewer's pinned card.
  const cardData = useMemo(() => ({ rows, columns: defaultColumns }), [rows]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || isScrolling || isShiftPressed || isCommandPressed || isHoveringActions) return;

    if (cardRef.current && actionsRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;

      const computedStyle = getComputedStyle(cardRef.current);
      const zoomScale = parseFloat(computedStyle.getPropertyValue('--zoom-scale')) || 1;
      const adjustedY = relativeY / zoomScale;

      if (!initialPositionSetRef.current) {
        actionsRef.current.style.transition = 'none';
        actionsRef.current.style.top = `${adjustedY}px`;
        actionsRef.current.style.opacity = '0';
        requestAnimationFrame(() => {
          if (actionsRef.current) {
            actionsRef.current.style.transition = 'opacity 0.2s ease-out';
            actionsRef.current.style.opacity = '1';
          }
        });
        initialPositionSetRef.current = true;
        return;
      }

      actionsRef.current.style.top = `${adjustedY}px`;
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || isScrolling || isShiftPressed || isCommandPressed) return;
    setIsHovered(true);
    initialPositionSetRef.current = false;
    handleMouseMove(e);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsHoveringActions(false);
    initialPositionSetRef.current = false;
  };

  const handleActionsMouseEnter = () => {
    setIsHoveringActions(true);
    setIsHovered(true);
  };

  const handleActionsMouseLeave = () => {
    setIsHoveringActions(false);
  };

  const handleRowEdit = (row: any) => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('phenotype' as CohortViewType, row);
  };

  const handleContextMenu = (e: React.MouseEvent, rowIndex: number | null = null) => {
    e.preventDefault();
    setRightClickMenu({
      position: { x: e.clientX, y: e.clientY },
      rowIndex,
    });
  };

  const handleCloseRightClickMenu = () => {
    setRightClickMenu(null);
  };

  const handleDeleteCohort = async () => {
    if (!window.confirm(`Are you sure you want to delete "${cohortDef.cohort.name || 'Unnamed Cohort'}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const cohortModel = definitionService._cohortModels.get(cohortId);
      if (cohortModel) {
        await cohortModel.deleteCohort();
        await studyDataService.refreshStudyData();
      }
    } catch (error) {
      console.error('Failed to delete cohort:', error);
      alert('Failed to delete cohort. Please try again.');
    }
  };

  const handleAddPhenotype = (type: string) => {
    definitionService.addPhenotype(cohortId, type);
  };

  // --- CohortCardViewer wiring: routes every interaction through the study
  // data service so edits/drags/renames persist to the correct cohort model. ---
  const handleCellValueChanged = useCallback(
    (event: any, selectedRows?: any[]) => {
      definitionService.onCellValueChanged(cohortId, event, selectedRows);
    },
    [definitionService, cohortId]
  );

  const handleRowDragEnd = useCallback(
    (newRowData: any[]) => {
      definitionService.onRowDragEnd(cohortId, newRowData);
    },
    [definitionService, cohortId]
  );

  const handleSectionDrop = useCallback(
    (draggedId: string, newType: string, newRowData: any[]) => {
      definitionService.movePhenotypeToSection(cohortId, draggedId, newType, newRowData);
    },
    [definitionService, cohortId]
  );

  const handleComponentDrop = useCallback(
    (draggedId: string, targetParentId: string) => {
      definitionService.makePhenotypeComponentOf(cohortId, draggedId, targetParentId);
    },
    [definitionService, cohortId]
  );

  const handleCanMakeComponent = useCallback(
    (draggedId: string, targetId: string) =>
      definitionService.canMakePhenotypeComponentOf(cohortId, draggedId, targetId),
    [definitionService, cohortId]
  );

  const handleNameChange = useCallback(
    (name: string) => {
      definitionService.updateCohortName(cohortId, name);
    },
    [definitionService, cohortId]
  );

  const handleDescriptionChange = useCallback(
    (description: string) => {
      definitionService.updateCohortDescription(cohortId, description);
    },
    [definitionService, cohortId]
  );

  const openCohort = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCardClick(cohortDef);
  };

  const arrowSvg = (
    <svg width="14" height="14" viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );

  const getRightClickMenuItems = (): RightClickMenuItem[] => {
    if (rightClickMenu?.rowIndex !== null && rightClickMenu?.rowIndex !== undefined) {
      const row = rows[rightClickMenu.rowIndex];
      return [
        { label: 'Edit Phenotype', onClick: () => handleRowEdit(row) },
        { label: 'Duplicate Row', onClick: () => {}, disabled: true },
        { label: 'Delete Row', onClick: () => {}, disabled: true, divider: true },
        { label: 'Move Up', onClick: () => {}, disabled: rightClickMenu.rowIndex === 0 },
        { label: 'Move Down', onClick: () => {}, disabled: rightClickMenu.rowIndex === rows.length - 1 },
      ];
    }

    return [
      {
        label: 'Open Cohort',
        onClick: () => onCardClick(cohortDef),
        icon: arrowSvg,
      },
      {
        label: 'Add Phenotype',
        onClick: () => {},
        disabled: false,
        divider: true,
        submenu: [
          { label: 'Entry', onClick: () => handleAddPhenotype('entry'), keepOpenOnClick: true },
          { label: 'Inclusion', onClick: () => handleAddPhenotype('inclusion'), keepOpenOnClick: true },
          { label: 'Exclusion', onClick: () => handleAddPhenotype('exclusion'), keepOpenOnClick: true },
          { label: 'Baseline Characteristic', onClick: () => handleAddPhenotype('baseline'), keepOpenOnClick: true },
          { label: 'Outcome', onClick: () => handleAddPhenotype('outcome'), keepOpenOnClick: true },
        ],
      },
      {
        label: 'Info',
        onClick: () => {
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          cohortViewer.displayExtraContent('info', null);
        },
        icon: arrowSvg,
      },
      {
        label: 'Database',
        onClick: () => {
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          cohortViewer.displayExtraContent('database', null);
        },
        icon: arrowSvg,
      },
      {
        label: 'Codelists',
        onClick: () => {
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          cohortViewer.displayExtraContent('codelists', null);
        },
        icon: arrowSvg,
      },
      {
        label: 'Constants',
        onClick: () => {
          const cohortViewer = TwoPanelCohortViewerService.getInstance();
          cohortViewer.displayExtraContent('constants', null);
        },
        icon: arrowSvg,
        divider: true,
      },
      { label: 'Duplicate Cohort', onClick: () => {}, disabled: true },
      { label: 'Delete Cohort', onClick: handleDeleteCohort, disabled: false },
    ];
  };

  return (
    <div className={`${styles.verticalCardContainer} ${isReportMode ? styles.verticalCardContainerReport : ''}`}>
      <div>
        <div
          ref={cardRef}
          className={`${styles.cohortCard} ${isReportMode ? styles.cohortCardReport : ''} ${(isHoveringActions || rightClickMenu !== null) ? styles.forceHover : ''} ${(isShiftPressed || isCommandPressed) ? styles.noHover : ''}`}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => handleContextMenu(e, null)}
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            '--dynamic-arrow-size': 'min(75px, calc(30px / var(--zoom-scale)))',
          } as React.CSSProperties}
        >
          {isReportMode ? (
            <div className={`${styles.tableContainer} ${styles.reportMode}`}>
              <CohortDefinitionReportD3
                ref={d3ReportRef}
                rows={rows}
                cohortId={cohortId}
                onExpandClick={handleRowEdit}
              />
            </div>
          ) : (
            <>
              <CohortCardViewer
                cardMode
                data={cardData}
                currentlyViewing="cohort"
                cohortId={cohortId}
                cohortName={cohortDef.cohort.name || 'Unnamed Cohort'}
                description={cohortDef.cohort.description}
                onNameChange={handleNameChange}
                onDescriptionChange={handleDescriptionChange}
                onCellValueChanged={handleCellValueChanged}
                onRowDragEnd={handleRowDragEnd}
                onSectionDrop={handleSectionDrop}
                onComponentDrop={handleComponentDrop}
                canMakeComponent={handleCanMakeComponent}
              />
              <button
                className={styles.expandButton}
                onClick={openCohort}
                aria-label="Open cohort"
              >
                <img src={ArrowIcon} alt="Expand" className={styles.expandArrow} />
              </button>
            </>
          )}

          {/* Actions Container */}
          {(isHovered || rightClickMenu !== null) && (
            <CohortCardActions
              ref={actionsRef}
              cohortId={cohortId}
              studyDataService={studyDataService}
              onMouseEnter={handleActionsMouseEnter}
              onMouseLeave={handleActionsMouseLeave}
              onDeleteCohort={onDeleteCohort ? () => onDeleteCohort(cohortDef) : undefined}
            />
          )}
        </div>

        {/* Right Click Menu */}
        {rightClickMenu && (
          <ScaledRightClickMenu
            items={getRightClickMenuItems()}
            position={rightClickMenu.position}
            onClose={handleCloseRightClickMenu}
            zoomScale={parseFloat(getComputedStyle(cardRef.current || document.body).getPropertyValue('--zoom-scale')) || 1}
          />
        )}
      </div>
    </div>
  );
});

CohortCardLightWeight.displayName = 'CohortCardLightWeight';
