import React, { useCallback, useMemo, useRef, useState } from 'react';
import styles from './CohortCardLightWeight.module.css';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { CohortCardActions } from './CohortCardActions';
import { TwoPanelCohortViewerService } from '../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { CohortViewType } from '../../CohortViewer/CohortViewer';
import { RightClickMenuItem } from '../../../components/RightClickMenu/RightClickMenu';
import { ScaledRightClickMenu } from '../../../components/RightClickMenu/ScaledRightClickMenu';
import { useReportMode } from '../../../contexts/ReportModeContext';
import { DeleteConfirmModal } from '../../../components/DeleteConfirmModal/DeleteConfirmModal';
import { CohortDefinitionReportD3, CohortDefinitionReportD3Ref } from './CohortDefinitionReportD3';
import { CohortCardViewer } from '../../CohortViewer/CohortCardViewer/CohortCardViewer';
import { defaultColumns } from '../../CohortViewer/CohortDataService/CohortColumnDefinitions';
import { TableData } from '../../CohortViewer/tableTypes';

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
  isDragging: _isDragging,
  isScrolling: _isScrolling,
  isShiftPressed,
  isCommandPressed,
  onDeleteCohort,
}) => {
  const { isReportMode } = useReportMode();
  const cardRef = useRef<HTMLDivElement>(null);
  const d3ReportRef = useRef<CohortDefinitionReportD3Ref>(null);
  const [rightClickMenu, setRightClickMenu] = useState<{ position: { x: number; y: number }; rowIndex: number | null } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const definitionService = studyDataService.cohort_definitions_service;
  const rows = cohortDef.table_data.rows;

  // The card renders the same columns as the two-panel viewer's pinned card.
  const cardData = useMemo<TableData>(() => ({ rows, columns: defaultColumns } as TableData), [rows]);


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
    setShowDeleteModal(true);
  };

  const confirmDeleteCohort = async () => {
    setShowDeleteModal(false);
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
          className={`${styles.cohortCard} ${isReportMode ? styles.cohortCardReport : ''} ${rightClickMenu !== null ? styles.forceHover : ''} ${(isShiftPressed || isCommandPressed) ? styles.noHover : ''}`}
          onMouseDown={e => e.stopPropagation()}
          onContextMenu={(e) => handleContextMenu(e, null)}
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            '--dynamic-arrow-size': 'min(75px, calc(30px / var(--zoom-scale)))',
            '--dynamic-button-size': 'min(34px, calc(26px / var(--zoom-scale)))',
            '--dynamic-font-size': 'min(16px, calc(12px / var(--zoom-scale)))',
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
            </>
          )}

          {/* Controls: top-right corner, visible on hover */}
          {!isReportMode && (
            <div className={styles.cardControls}>
              <CohortCardActions
                cohortId={cohortId}
                studyDataService={studyDataService}
                onDeleteCohort={onDeleteCohort ? () => onDeleteCohort(cohortDef) : undefined}
                onOpen={openCohort}
              />
            </div>
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

      {showDeleteModal && (
        <DeleteConfirmModal
          name={cohortDef.cohort.name || 'Unnamed Cohort'}
          entityName="Cohort"
          onConfirm={confirmDeleteCohort}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
});

CohortCardLightWeight.displayName = 'CohortCardLightWeight';
