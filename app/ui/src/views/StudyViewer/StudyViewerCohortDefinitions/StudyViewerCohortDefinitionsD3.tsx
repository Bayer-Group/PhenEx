import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import styles from './StudyViewerCohortDefinitions.module.css';
import { StudyDataService } from '../StudyDataService';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { deleteCohort } from '@/api/text_to_cohort/route';
import ArrowIcon from '../../../assets/icons/arrow-up-right.svg';
import typeStylesRaw from '../../../styles/study_types.module.css';

interface StudyViewerCohortDefinitionsD3Props {
  studyDataService: StudyDataService;
}

// Type color mapping from CSS
const TYPE_COLORS: Record<string, { text: string; bg: string; bgDim: string; border: string }> = {
  inclusion: {
    text: 'var(--color_inclusion)',
    bg: 'var(--color_inclusion)',
    bgDim: 'var(--color_inclusion_dim)',
    border: 'var(--color_inclusion)'
  },
  exclusion: {
    text: 'var(--color_exclusion)',
    bg: 'var(--color_exclusion)',
    bgDim: 'var(--color_exclusion_dim)',
    border: 'var(--color_exclusion)'
  },
  outcome: {
    text: 'var(--color_outcome)',
    bg: 'var(--color_outcome)',
    bgDim: 'var(--color_outcome_dim)',
    border: 'var(--color_outcome)'
  },
  entry: {
    text: 'var(--color_entry)',
    bg: 'var(--color_entry)',
    bgDim: 'var(--color_entry_dim)',
    border: 'var(--color_entry)'
  },
  baseline: {
    text: 'var(--color_baseline)',
    bg: 'var(--color_baseline)',
    bgDim: 'var(--color_baseline_dim)',
    border: 'var(--color_baseline)'
  },
  component: {
    text: 'var(--color_component)',
    bg: 'var(--color_component)',
    bgDim: 'var(--color_component_dim)',
    border: 'var(--color_component)'
  }
};

const ROW_HEIGHT = 40;
const CARD_WIDTH = 350;
const CARD_PADDING = 10;
const TYPE_COL_WIDTH = 40;
const DRAG_COL_WIDTH = 30;
const SELECTION_COL_WIDTH = 5;
const HEADER_HEIGHT = 60;

export const StudyViewerCohortDefinitionsD3: React.FC<StudyViewerCohortDefinitionsD3Props> = ({ studyDataService }) => {
  const [cohortDefinitions, setCohortDefinitions] = useState<CohortWithTableData[] | null>(null);
  const [deleteConfirmCohort, setDeleteConfirmCohort] = useState<CohortWithTableData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  // Initialize view state from local storage if available
  const [viewState, setViewState] = useState(() => {
    const studyId = studyDataService.study_data?.id;
    if (studyId) {
      try {
        const saved = localStorage.getItem(`cohort-view-state-${studyId}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved view state', e);
      }
    }
    return { x: 0, y: 0, scale: 1 };
  });

  const [isScrolling, setIsScrolling] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCommandPressed, setIsCommandPressed] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const persistTimeout = useRef<NodeJS.Timeout | null>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const cohortDefinitionsRef = useRef(cohortDefinitions);

  // Update ref when cohortDefinitions changes
  useEffect(() => {
    cohortDefinitionsRef.current = cohortDefinitions;
  }, [cohortDefinitions]);

  // Persist view state changes to local storage (debounced)
  useEffect(() => {
    const studyId = studyDataService.study_data?.id;
    if (!studyId) return;

    const timeoutId = setTimeout(() => {
      localStorage.setItem(`cohort-view-state-${studyId}`, JSON.stringify(viewState));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [viewState, studyDataService.study_data?.id]);

  // Track shift/command keys globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Meta' || e.key === 'Control') setIsCommandPressed(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
      if (e.key === 'Meta' || e.key === 'Control') setIsCommandPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Load cohort definitions
  useEffect(() => {
    const updateCohortDefinitions = () => {
      const definitions = studyDataService.cohort_definitions_service.getCohortDefinitions();
      setCohortDefinitions(definitions);
    };

    updateCohortDefinitions();
    studyDataService.addStudyDataServiceListener(updateCohortDefinitions);

    return () => {
      studyDataService.removeStudyDataServiceListener(updateCohortDefinitions);
    };
  }, [studyDataService]);

  // Listen to singleton CohortDataService for real-time updates
  useEffect(() => {
    const cohortDataService = CohortDataService.getInstance();

    const handleCohortDataChange = () => {
      const editedCohortId = studyDataService.cohort_definitions_service.getActiveCohortId();
      const currentDefinitions = cohortDefinitionsRef.current;
      
      if (!editedCohortId || !currentDefinitions) return;

      const cohortIndex = currentDefinitions.findIndex(def => def.cohort.id === editedCohortId);
      if (cohortIndex === -1) return;

      const updatedDefinitions = [...currentDefinitions];
      const refreshedData = studyDataService.cohort_definitions_service.refreshSingleCohort(editedCohortId);
      
      if (refreshedData) {
        updatedDefinitions[cohortIndex] = refreshedData;
        setCohortDefinitions(updatedDefinitions);
      }
    };

    cohortDataService.addDataChangeListener(handleCohortDataChange);
    studyDataService.cohort_definitions_service.addListener(handleCohortDataChange);

    return () => {
      cohortDataService.removeDataChangeListener(handleCohortDataChange);
      studyDataService.cohort_definitions_service.removeListener(handleCohortDataChange);
    };
  }, [studyDataService]);

  // Setup D3 zoom behavior (once on mount)
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    
    // Create zoom behavior with custom wheel handling
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 1])
      .on('zoom', (event) => {
        const transform = event.transform;
        
        // Update view state (debounced)
        if (persistTimeout.current) clearTimeout(persistTimeout.current);
        persistTimeout.current = setTimeout(() => {
          setViewState({ x: transform.x, y: transform.y, scale: transform.k });
        }, 500);
        
        // Apply transform to main group
        svg.select('.main-group')
          .attr('transform', `translate(${transform.x}, ${transform.y}) scale(${transform.k})`);
      });

    // Custom wheel handler for directional control
    const wheelHandler = function(this: SVGSVGElement, event: WheelEvent) {
      event.preventDefault();
      
      setIsScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 150);

      const isShift = event.shiftKey;
      const isCommand = event.metaKey || event.ctrlKey;
      
      const currentTransform = d3.zoomTransform(this);
      let newTransform = currentTransform;

      if (isCommand) {
        // Zoom with Command/Ctrl
        const zoomSpeed = -event.deltaY * 0.01;
        const scale = Math.max(0.3, Math.min(1, currentTransform.k * (1 + zoomSpeed)));
        
        // Zoom around center
        const [centerX, centerY] = [this.clientWidth / 2, this.clientHeight / 2];
        const pointX = (centerX - currentTransform.x) / currentTransform.k;
        const pointY = (centerY - currentTransform.y) / currentTransform.k;
        newTransform = d3.zoomIdentity
          .translate(centerX - pointX * scale, centerY - pointY * scale)
          .scale(scale);
      } else if (isShift) {
        // Horizontal pan with Shift
        const deltaX = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        newTransform = currentTransform.translate(-deltaX / currentTransform.k, 0);
      } else {
        // Vertical pan
        newTransform = currentTransform.translate(0, -event.deltaY / currentTransform.k);
      }

      svg.call(zoom.transform, newTransform);
    };

    // Apply zoom behavior and custom wheel
    svg.call(zoom);
    svg.on('wheel.zoom', wheelHandler);
    
    // Set initial transform from viewState
    const initialTransform = d3.zoomIdentity
      .translate(viewState.x, viewState.y)
      .scale(viewState.scale);
    svg.call(zoom.transform, initialTransform);

    zoomBehavior.current = zoom;

    return () => {
      svg.on('.zoom', null);
      if (persistTimeout.current) clearTimeout(persistTimeout.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []); // Only run once on mount

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || !cohortDefinitions || cohortDefinitions.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Main group for zoom/pan (transform applied by zoom behavior)
    const mainGroup = svg
      .append('g')
      .attr('class', 'main-group');

    // Render each cohort
    cohortDefinitions.forEach((cohortDef, cohortIndex) => {
      const cohortX = cohortIndex * (CARD_WIDTH + 40) + 20;
      const cohortY = 20;
      
      const cohortGroup = mainGroup
        .append('g')
        .attr('class', 'cohort-card')
        .attr('transform', `translate(${cohortX}, ${cohortY})`)
        .style('cursor', 'pointer');

      // Card background
      cohortGroup
        .append('rect')
        .attr('class', 'card-background')
        .attr('width', CARD_WIDTH)
        .attr('height', HEADER_HEIGHT + cohortDef.table_data.rows.length * ROW_HEIGHT + 20)
        .attr('rx', 8)
        .attr('fill', 'var(--background-color)')
        .attr('stroke', 'var(--line-color)')
        .attr('stroke-width', 1)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
        .on('mouseover', function() {
          if (isShiftPressed || isCommandPressed || isScrolling) return;
          d3.select(this)
            .attr('fill', 'white')
            .attr('stroke', 'var(--color_accent_blue)')
            .attr('stroke-width', 3)
            .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))');
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('fill', 'var(--background-color)')
            .attr('stroke', 'var(--line-color)')
            .attr('stroke-width', 1)
            .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
        })
        .on('click', () => {
          const studyId = cohortDef.cohort.study_id || studyDataService.study_data?.id;
          const cohortId = cohortDef.cohort.id;
          if (studyId && cohortId) {
            navigate(`/studies/${studyId}/cohorts/${cohortId}`);
          }
        });

      // Header
      const headerGroup = cohortGroup
        .append('g')
        .attr('class', 'header')
        .attr('transform', `translate(0, ${-HEADER_HEIGHT})`);

      headerGroup
        .append('text')
        .attr('x', 0)
        .attr('y', HEADER_HEIGHT - 15)
        .attr('font-family', 'IBMPlexSans-bold')
        .attr('font-size', 16)
        .attr('fill', 'var(--text-color)')
        .text(cohortDef.cohort.name || 'Unnamed Cohort')
        .style('pointer-events', 'none');

      // Arrow button
      const arrowButton = headerGroup
        .append('g')
        .attr('class', 'arrow-button')
        .attr('transform', `translate(${CARD_WIDTH - 40}, ${HEADER_HEIGHT - 40})`)
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          const studyId = cohortDef.cohort.study_id || studyDataService.study_data?.id;
          const cohortId = cohortDef.cohort.id;
          if (studyId && cohortId) {
            navigate(`/studies/${studyId}/cohorts/${cohortId}`);
          }
        });

      arrowButton
        .append('rect')
        .attr('width', 30)
        .attr('height', 30)
        .attr('rx', 4)
        .attr('fill', 'transparent')
        .on('mouseover', function() {
          d3.select(this).attr('fill', '#f0f0f0');
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill', 'transparent');
        });

      // Arrow icon (SVG path approximation)
      arrowButton
        .append('path')
        .attr('d', 'M10,20 L20,10 M15,10 L20,10 L20,15')
        .attr('stroke', 'var(--text-color-secondary)')
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .style('pointer-events', 'none');

      // Rows
      const rowsGroup = cohortGroup
        .append('g')
        .attr('class', 'rows')
        .attr('transform', `translate(0, ${CARD_PADDING})`);

      cohortDef.table_data.rows.forEach((row, rowIndex) => {
        const rowY = rowIndex * ROW_HEIGHT;
        const effectiveType = row.effective_type || row.type;
        const typeColors = TYPE_COLORS[effectiveType] || TYPE_COLORS.entry;

        const rowGroup = rowsGroup
          .append('g')
          .attr('class', 'row')
          .attr('transform', `translate(0, ${rowY})`);

        // Row background with type color
        rowGroup
          .append('rect')
          .attr('class', 'row-bg')
          .attr('width', CARD_WIDTH)
          .attr('height', ROW_HEIGHT)
          .attr('fill', typeColors.bgDim)
          .attr('stroke', 'transparent')
          .attr('stroke-width', 0);

        let currentX = 0;

        // Selection indicator
        rowGroup
          .append('rect')
          .attr('x', currentX)
          .attr('y', 0)
          .attr('width', SELECTION_COL_WIDTH)
          .attr('height', ROW_HEIGHT)
          .attr('fill', row.selected ? typeColors.border : 'transparent');
        currentX += SELECTION_COL_WIDTH;

        // Drag handle
        rowGroup
          .append('g')
          .attr('class', 'drag-handle')
          .attr('transform', `translate(${currentX + DRAG_COL_WIDTH / 2}, ${ROW_HEIGHT / 2})`)
          .style('cursor', 'grab')
          .call(selection => {
            // Three dots for drag handle
            [-4, 0, 4].forEach(dy => {
              selection
                .append('circle')
                .attr('cx', 0)
                .attr('cy', dy)
                .attr('r', 1.5)
                .attr('fill', '#999');
            });
          });
        currentX += DRAG_COL_WIDTH;

        // Type label with hierarchical index or type
        const typeText = row.hierarchical_index || row.type || '';
        rowGroup
          .append('text')
          .attr('x', currentX + TYPE_COL_WIDTH / 2)
          .attr('y', ROW_HEIGHT / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 12)
          .attr('font-family', 'IBMPlexSans')
          .attr('fill', typeColors.text)
          .text(typeText);
        currentX += TYPE_COL_WIDTH;

        // Name text
        const nameWidth = CARD_WIDTH - currentX - 40;
        const nameText = rowGroup
          .append('text')
          .attr('x', currentX + 10)
          .attr('y', ROW_HEIGHT / 2)
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 14)
          .attr('font-family', 'IBMPlexSans')
          .attr('fill', 'var(--text-color)')
          .text(row.name || '');

        // Truncate name if too long
        const textNode = nameText.node();
        if (textNode) {
          const bbox = textNode.getBBox();
          if (bbox.width > nameWidth) {
            let text = row.name || '';
            while (bbox.width > nameWidth - 20 && text.length > 0) {
              text = text.slice(0, -1);
              nameText.text(text + '...');
            }
          }
        }

        // Arrow icon for navigation
        const arrowGroup = rowGroup
          .append('g')
          .attr('class', 'row-arrow')
          .attr('transform', `translate(${CARD_WIDTH - 30}, ${ROW_HEIGHT / 2 - 10})`)
          .style('cursor', 'pointer')
          .style('opacity', 0)
          .on('mouseover', function() {
            d3.select(this).style('opacity', 1);
          })
          .on('mouseout', function() {
            d3.select(this).style('opacity', 0);
          })
          .on('click', (event: MouseEvent) => {
            event.stopPropagation();
            // Handle row click/navigation
          });

        arrowGroup
          .append('path')
          .attr('d', 'M5,10 L15,10 M10,5 L15,10 L10,15')
          .attr('stroke', 'var(--color_accent_blue)')
          .attr('stroke-width', 1.5)
          .attr('fill', 'none')
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round');

        // Show arrow on row hover
        rowGroup
          .on('mouseover', function() {
            if (isShiftPressed || isCommandPressed || isScrolling) return;
            d3.select(this).select('.row-arrow').style('opacity', 1);
          })
          .on('mouseout', function() {
            d3.select(this).select('.row-arrow').style('opacity', 0);
          });
      });
    });
  }, [cohortDefinitions, navigate, studyDataService, isShiftPressed, isCommandPressed, isScrolling]);
  const handleCreateFirstCohort = async () => {
    try {
      const studyId = studyDataService.study_data?.id;
      
      if (!studyId) {
        console.error('No study ID found');
        return;
      }

      const { createAndNavigateToNewCohort } = await import('@/views/LeftPanel/studyNavigationHelpers');
      await createAndNavigateToNewCohort(studyId, navigate);
    } catch (error) {
      console.error('Failed to create cohort:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmCohort) return;
    
    try {
      await deleteCohort(deleteConfirmCohort.cohort.id);
      
      const studyId = studyDataService.study_data?.id;
      if (studyId) {
        const CohortsDataService = (await import('@/views/LeftPanel/CohortsDataService')).CohortsDataService;
        const cohortsDataService = CohortsDataService.getInstance();
        
        // Force cache refresh
        // @ts-ignore
        cohortsDataService._userStudies = null;
        // @ts-ignore
        cohortsDataService._publicStudies = null;
        // @ts-ignore
        if (cohortsDataService._studyCohortsCache) {
          // @ts-ignore
          cohortsDataService._studyCohortsCache.delete(studyId);
        }
        
        // @ts-ignore
        cohortsDataService.notifyListeners();
        
        const cohorts = await cohortsDataService.getCohortsForStudy(studyId);
        const studyData = { ...studyDataService.study_data, cohorts };
        studyDataService.loadStudyData(studyData);
      }
      
      setDeleteConfirmCohort(null);
    } catch (error) {
      console.error('Failed to delete cohort:', error);
      alert('Failed to delete cohort. Please try again.');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmCohort(null);
  };

  // Show loading state or empty state when data is not ready
  if (!cohortDefinitions || cohortDefinitions.length === 0) {
    if (cohortDefinitions === null) {
      return (
        <div className={styles.cohortsContainer}>
          <div className={styles.emptyState}>
            Loading cohort definitions...
          </div>
        </div>
      );
    }
    
    // Empty state with CTA
    return (
      <div className={styles.cohortsContainer}>
        <div className={styles.emptyStateWithCta}>
          <div className={styles.ctaContent}>
            <h3 className={styles.ctaTitle}>Create your first cohort</h3>
            <p className={styles.ctaDescription}>
              Define patient populations by adding inclusion and exclusion criteria to build your cohort.
            </p>
            <button 
              className={styles.ctaButton}
              onClick={handleCreateFirstCohort}
            >
              Create Your First Cohort
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        ref={containerRef}
        className={styles.content}
        style={{ 
          overflow: 'hidden',
          touchAction: 'none'
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            background: 'transparent'
          }}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmCohort && (
        <div className={styles.modalOverlay} onClick={handleCancelDelete}>
          <div className={styles.alertModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.alertIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className={styles.alertTitle}>Delete Cohort?</h3>
            <p className={styles.alertMessage}>
              Are you sure you want to delete <strong>"{deleteConfirmCohort.cohort.name || 'Unnamed Cohort'}"</strong>?
            </p>
            <p className={styles.alertWarning}>
              This action cannot be undone. All cohort definitions and criteria will be permanently deleted.
            </p>
            <div className={styles.alertActions}>
              <button className={styles.alertCancelButton} onClick={handleCancelDelete}>
                Cancel
              </button>
              <button className={styles.alertDeleteButton} onClick={handleConfirmDelete}>
                Delete Cohort
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
