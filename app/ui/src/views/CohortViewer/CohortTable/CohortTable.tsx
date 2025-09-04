import { FC, forwardRef, useEffect, Component, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Grid Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong with the grid. Please try refreshing the page.</div>;
    }
    return this.props.children;
  }
}

import styles from './CohortTable.module.css';
import '../../../styles/variables.css';
import { themeQuartz } from 'ag-grid-community';

import { ModuleRegistry } from '@ag-grid-community/core';

import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { TableData, TableRow } from '../tableTypes';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';

// Register AG Grid Modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

interface CohortTableProps {
  data: TableData;
  currentlyViewing: string;
  onCellValueChanged?: (event: any) => void;
  onRowDragEnd?: (newRowData: any[]) => void;
}

export const CohortTable = forwardRef<any, CohortTableProps>(
  ({ data, currentlyViewing, onCellValueChanged, onRowDragEnd }, ref) => {
    const myTheme = themeQuartz.withParams({
      accentColor: 'var(--color-accent-bright)',
      borderColor: 'var(--line-color-grid)',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 14,
      headerFontWeight: 'bold',
      headerRowBorder: true,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'var(--background-color, red)',
      rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
      backgroundColor: 'var(--background-color)',
    });

    const onGridReady = () => {
      if (ref && typeof ref === 'object' && ref.current?.api) {
        ref.current.api.resetRowHeights();
      }
    };

    const handleRowDragEnd = () => {
      if (!onRowDragEnd) {
        return;
      }

      // Get the current order from the grid and update indices
      const newRowData: any[] = [];
      if (ref && typeof ref === 'object' && ref.current?.api) {
        ref.current.api.forEachNode((node: any) => {
          newRowData.push(node.data);
        });
      }

      // Simple validation: ensure we have data and all items have the required properties
      if (newRowData.length === 0) {
        return;
      }

      // Validate that all rows have required properties
      const invalidRows = newRowData.filter(row => !row.id || !row.type);
      if (invalidRows.length > 0) {
        return;
      }

      // Update indices within each type for the new data
      const groupedByType: { [key: string]: any[] } = {};
      newRowData.forEach(row => {
        if (!groupedByType[row.type]) {
          groupedByType[row.type] = [];
        }
        groupedByType[row.type].push(row);
      });


      // Update indices within each type
      Object.keys(groupedByType).forEach(type => {
        groupedByType[type].forEach((phenotype, index) => {
          phenotype.index = index + 1;
        });
      });

      // Call the parent callback with the reordered data
      onRowDragEnd(newRowData);
    };

    const NoRowsOverlayOutcomes: FC = () => {
      return (
        <div className={styles.noRowsOverlay}>
          <span className={styles.noRowsBottomLine}>
            {/* <span className={styles.noRows_section}>
              How do you want to assess post-index data?
            </span>
            <br></br> */}
            <span className={styles.noRowsTopLine}>
              <span className={styles.buttonAppearance}>Click Add Phenotype in the action bar
              above to add <span className={styles.noRows_section}>outcomes</span>.</span>
            </span>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <span className={styles.noRowsCommentLine}>
              PhenEx can then{' '}
              <span className={styles.noRows_action}>perform a time-to-event analysis</span>
            </span>
          </span>
        </div>
      );
    };

    const NoRowsOverlayComponents: FC = () => {
      return (
        <div className={styles.noRowsOverlay}>
          <div className={styles.noRowsOverlayComponents}>
            <span className={styles.noRowsBottomLine}>
              <span className={styles.noRows_section}>Add a component phenotype</span>
              <br></br>
              <span className={styles.noRowsTopLine}>
                <ul>
                  <li>
                    Click <span className={styles.buttonAppearance}>Add Component</span> in right
                    above this table to add a component phenotype.
                  </li>
                  <li>
                    Component phenotypes can then be accessed by Composite Phenotypes such as
                    LogicPhenotype, ScorePhenotype, ArithemticPhenotype, etc.
                  </li>
                  <li>
                    All component phenotypes can be found in the{' '}
                    <span className={styles.buttonAppearance}>All Phenotypes</span> tab.
                  </li>
                </ul>
              </span>
              <br></br>
            </span>
          </div>
        </div>
      );
    };

    const NoRowsOverlayText = () => {
      if (currentlyViewing === 'outcomes') {
        return NoRowsOverlayOutcomes;
      } else if (currentlyViewing === 'baseline') {
        return NoRowsOverlayCharacteristics;
      } else if (currentlyViewing === 'components') {
        return NoRowsOverlayComponents;
      }
      return NoRowsOverlayCohort;
    };

    const NoRowsOverlayCohort: FC = () => {
      return (
        <div className={styles.noRowsOverlay}>
          <span className={styles.noRowsBottomLine}>
            {/* <span className={styles.noRows_section}>Define your entry, inclusion and exclusion criteria.</span>
            <br></br> */}
            <span className={styles.noRowsTopLine}>
              <span className={styles.buttonAppearance}>Click Add Phenotype in the action bar
              above to define your cohort.</span> 
              {/* <ol>
                <li>
                  the cohort <span className={styles.noRows_section}>entry</span> criterion,
                  <ul>
                    <li>this defines the <span className={styles.noRows_section}>index date</span> for each
                  patient</li>
                  </ul>
                  
                </li>
                <li>
                  <span className={styles.noRows_section}>inclusion</span> criteria, which all
                  patients must fulfill at index date.
                </li>
                <li>
                  <span className={styles.noRows_section}>exclusion</span> criteria, which patients
                  may not fulfill at index date.
                </li>
              </ol> */}
            </span>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <br></br>            <span className={styles.noRowsCommentLine}>
              PhenEx can then <span className={styles.noRows_action}>generate your cohort</span>
            </span>
          </span>
        </div>
      );
    };
    
    const NoRowsOverlayCharacteristics: FC = () => {
      return (
        <div className={styles.noRowsOverlay}>
          <span className={styles.noRowsBottomLine}>
            {/* <span className={styles.noRows_section}>
              How do you want to assess patients at index date?
            </span>
            <br></br> */}
            <span className={styles.noRowsTopLine}>
              <span className={styles.buttonAppearance}>Click Add Phenotype in the action bar
              above to add <span className={styles.noRows_section}>baseline characteristics</span>.</span>
            </span>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <br></br>

            <span className={styles.noRowsCommentLine}>
              PhenEx can then <span className={styles.noRows_action}>create Table 1</span>
            </span>
          </span>
        </div>
      );
    };

    useEffect(() => {
      if (ref && typeof ref === 'object' && ref.current?.api) {
        ref.current.api.resetRowHeights();
      }
    }, [data]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;

        // Check if click is inside grid or editor
        const gridElement = document.querySelector('.ag-theme-quartz');
        const popupEditor = document.querySelector('.ag-popup-editor');

        // If we don't have either element, or don't have an active editor, don't do anything
        if (!gridElement || !popupEditor) return;

        // Check if the click is inside the grid or the popup editor
        const isInsidePopup = popupEditor.contains(target);

        // Only stop editing if click is outside both the grid AND the popup editor
        if (!isInsidePopup) {
          if (ref && typeof ref === 'object' && ref.current?.api) {
            ref.current.api.stopEditing();
          }
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (ref && typeof ref === 'object' && ref.current?.api) {
            ref.current.api.deselectAll();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, []);

    // Subscribe to right panel changes to auto-select matching rows
    useEffect(() => {
      const cohortViewerService = TwoPanelCohortViewerService.getInstance();
      
      const handleRightPanelChange = (viewType: any, extraData: any) => {
        
        if (viewType === 'phenotype' && extraData && extraData.id && ref && typeof ref === 'object' && ref.current?.api) {
          // Clear existing selections first
          ref.current.api.deselectAll();
          
          // Find the row with matching ID
          const matchingRowNode = ref.current.api.getRowNode(extraData.id);
          if (matchingRowNode) {
            matchingRowNode.setSelected(true);
            // Force refresh of cell renderers to update selection state
            ref.current.api.refreshCells({ force: true });
            // Optionally scroll to the selected row
            ref.current.api.ensureNodeVisible(matchingRowNode);
          } else {
            // Try alternative approach - iterate through all nodes to find by data.id
            ref.current.api.forEachNode((node: any) => {
              if (node.data && node.data.id === extraData.id) {
                node.setSelected(true);
                // Force refresh of cell renderers to update selection state
                ref.current.api.refreshCells({ force: true });
                ref.current.api.ensureNodeVisible(node);
              }
            });
          }
        } else {
          // Clear selections when not viewing a phenotype
          if (ref && typeof ref === 'object' && ref.current?.api) {
            ref.current.api.deselectAll();
          }
        }
      };

      // Subscribe to service changes
      cohortViewerService.addListener(handleRightPanelChange);
      
      // Initial check for current state (handles both component mount and data reload)
      const currentViewType = cohortViewerService.getCurrentViewType();
      const currentExtraData = cohortViewerService.getExtraData();
      
      // Delay the initial check to ensure grid is ready after data reload
      // setTimeout(() => {
        handleRightPanelChange(currentViewType, currentExtraData);
      // }, 100);

      return () => {
        cohortViewerService.removeListener(handleRightPanelChange);
      };
    }, [data.rows, data]); // Re-run when row data changes (handles table reload)

    // Separate effect to sync selection with current right panel state on every data refresh
    useEffect(() => {
      const cohortViewerService = TwoPanelCohortViewerService.getInstance();
      
      // Always check current right panel state when data changes
      const currentViewType = cohortViewerService.getCurrentViewType();
      const currentExtraData = cohortViewerService.getExtraData();
      
      
      // Use a small delay to ensure grid is ready after data update
      setTimeout(() => {
        if (currentViewType === 'phenotype' && currentExtraData && currentExtraData.id && ref && typeof ref === 'object' && ref.current?.api) {
          // Clear existing selections first
          ref.current.api.deselectAll();
          
          // Find the row with matching ID
          const matchingRowNode = ref.current.api.getRowNode(currentExtraData.id);
          if (matchingRowNode) {
            matchingRowNode.setSelected(true);
            // Force refresh of cell renderers to update selection state
            ref.current.api.refreshCells({ force: true });
            ref.current.api.ensureNodeVisible(matchingRowNode);
          } else {
            // Try alternative approach - iterate through all nodes to find by data.id
            let found = false;
            ref.current.api.forEachNode((node: any) => {
              if (node.data && node.data.id === currentExtraData.id) {
                node.setSelected(true);
                // Force refresh of cell renderers to update selection state
                ref.current.api.refreshCells({ force: true });
                ref.current.api.ensureNodeVisible(node);
                found = true;
              }
            });
            
            if (!found) {
            }
          }
        } else {
          // Clear selections when not viewing a phenotype or no current data
          if (ref && typeof ref === 'object' && ref.current?.api) {
            ref.current.api.deselectAll();
          }
        }
      }, 50);
    }, [data]);


    return (
      <div className={`ag-theme-quartz ${styles.gridContainer}`}>
        <ErrorBoundary>
          <AgGridReact
            key={currentlyViewing} // This will force a complete re-render when currentlyViewing changes
            ref={ref}
            noRowsOverlayComponent={NoRowsOverlayText()}
            rowData={data.rows}
            theme={myTheme}
            onGridReady={onGridReady}
            columnDefs={data.columns.length > 0 ? data.columns : []}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              menuTabs: ['filterMenuTab'],
              suppressHeaderMenuButton: true,
            }}
            cellSelection={false}
            rowSelection="multiple"
            onSelectionChanged={() => {
              if (ref && typeof ref === 'object' && ref.current?.api) {
                const selectedRows = ref.current.api.getSelectedRows();
              }
            }}
            suppressColumnVirtualisation={true}
            onCellValueChanged={onCellValueChanged}
            onRowDragEnd={handleRowDragEnd}
            onRangeSelectionChanged={() => {
            }}
            rowDragManaged={true}
            loadThemeGoogleFonts={true}
            animateRows={true}
            getRowHeight={params => {
              // Calculate height of CODELISTS
              let current_max_height = 48;
              if (
                params.data?.class_name == 'CodelistPhenotype' &&
                params.data.codelist?.codelist
              ) {
                const numEntries = Object.keys(params.data.codelist.codelist).length;
                const codelist_phenotype_height = Math.max(48, numEntries * 50 + 20); // Adjust row height based on number of codelist entries
                current_max_height = Math.max(current_max_height, codelist_phenotype_height);
              }

              // Calculate height of RELATIVE TIME RANGES
              if (
                params.data?.relative_time_range &&
                Array.isArray(params.data.relative_time_range)
              ) {
                const numEntries = params.data.relative_time_range.length;
                const time_range_phenotype_height = Math.max(48, numEntries * 30 + 20); // Adjust row height based on number of entries
                current_max_height = Math.max(current_max_height, time_range_phenotype_height);
              }

              if (!params.data?.description) {
                return current_max_height;
              }

              const descriptionCol = params.api.getColumnDef('description');
              if (!descriptionCol || !params.data?.description) return 48; // Increased minimum height
              const descWidth = descriptionCol.width || 250;
              const charPerLine = Math.floor(descWidth / 8);
              const lines = Math.ceil(params.data?.description.length / charPerLine);
              return Math.max(current_max_height, lines * 14 + 20); // Increased minimum height
            }}
            rowClassRules={
              {
                // 'rag-dark-outer': (params) => params.data.type === 'entry',
              }
            }
          />
        </ErrorBoundary>
      </div>
    );
  }
);
