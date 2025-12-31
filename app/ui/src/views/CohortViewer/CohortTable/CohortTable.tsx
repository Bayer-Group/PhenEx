import { FC, forwardRef, useEffect, Component, useState , useRef} from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { AgGridWithCustomScrollbars } from '../../../components/AgGridWithCustomScrollbars/AgGridWithCustomScrollbars';
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
  onCellValueChanged?: (event: any, selectedRows?: any[]) => void;
  onRowDragEnd?: (newRowData: any[]) => void;
  hideScrollbars?: boolean;
  hideVerticalScrollbar?: boolean;
  hideHorizontalScrollbar?: boolean;
  domLayout?: 'normal' | 'autoHeight' | 'print';
  headerHeight?: number;
  tableTheme?: any;
  tableGridOptions?: any;
  customGetRowHeight?: (params: any) => number;
}

export const CohortTable = forwardRef<any, CohortTableProps>(
  ({ data, currentlyViewing, onCellValueChanged, onRowDragEnd, hideScrollbars, hideVerticalScrollbar, hideHorizontalScrollbar, domLayout = 'normal', headerHeight = 28, tableTheme, tableGridOptions, customGetRowHeight }, ref) => {

    const default_theme = {
      accentColor: 'transparent',
      borderColor: 'var(--line-color-grid)',
      browserColorScheme: 'light',
      columnBorder: false,
      headerFontSize: 16,
      // headerFontWeight: 'bold',
      headerRowBorder: true,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'transparent',
      rowBorder: false,
      spacing: 0,
      wrapperBorder: false,
      backgroundColor: 'var(--background-color)',
      wrapperBorderRadius: 0,
    };
    const myTheme = themeQuartz.withParams(tableTheme ? tableTheme : default_theme);
    
    const default_options = {
          // turns OFF row hover, it's on by default
          suppressRowHoverHighlight: false,
          // turns ON column hover, it's off by default
          // columnHoverHighlight: true,

          // other grid options ...
      }
    const gridOptions = tableGridOptions ? tableGridOptions : default_options;

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const selectedNodesBeforeEdit = useRef<any[]>([]);

    const onGridReady = () => {
      if (ref && typeof ref === 'object' && ref.current?.api) {
        ref.current.api.resetRowHeights();
      }
    };

    const handleRowDragEnd = () => {
      console.log("=== CohortTable handleRowDragEnd START ===");
      
      if (!onRowDragEnd) {
        console.log("❌ No onRowDragEnd callback provided");
        return;
      }

      // Get the current order from the grid and update indices
      const newRowData: any[] = [];
      if (ref && typeof ref === 'object' && ref.current?.api) {
        ref.current.api.forEachNode((node: any) => {
          newRowData.push(node.data);
        });
      }
      
      console.log("📊 Collected newRowData:", newRowData.length, "rows");
      console.log("First 3 rows:", newRowData.slice(0, 3).map(r => ({ id: r.id, type: r.type, name: r.name })));

      // Simple validation: ensure we have data and all items have the required properties
      if (newRowData.length === 0) {
        console.log("❌ Validation failed: newRowData is empty");
        return;
      }

      // Validate that all rows have required properties
      const invalidRows = newRowData.filter(row => !row.id || !row.type);
      if (invalidRows.length > 0) {
        console.log("❌ Validation failed: Found", invalidRows.length, "invalid rows without id or type");
        console.log("Invalid rows:", invalidRows);
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

      console.log("✅ Calling onRowDragEnd with", newRowData.length, "rows");
      // Call the parent callback with the reordered data
      onRowDragEnd(newRowData);
      console.log("=== CohortTable handleRowDragEnd END ===");
    };

    const handleCellValueChanged = (event: any) => {
      // Get currently selected rows
      let selectedRows: any[] = [];
      if (ref && typeof ref === 'object' && ref.current?.api) {
        selectedRows = ref.current.api.getSelectedRows();
      }

      // Call the parent callback with the event and selected rows
      if (onCellValueChanged) {
        onCellValueChanged(event, selectedRows);
      }
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
              <span className={styles.buttonAppearance}>No <span className={styles.noRows_section}>outcomes</span> defined</span>
            </span>
          </span>
        </div>
      );
    };

    const NoRowsOverlayComponents: FC = () => {
      return (
        <div className={styles.noRowsOverlay}>
          <div className={styles.noRowsOverlayComponents}>
            <span className={styles.noRowsTopLine}>
              <span className={styles.buttonAppearance}> <span className={styles.noRows_section}></span>.</span>
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
              <span className={styles.buttonAppearance}>No phenotypes defined</span>
            </span>
          </span>
        </div>
      );
    };
    
    const NoRowsOverlayCharacteristics: FC = () => {
      return (
        <div className={styles.noRowsOverlay}>
          <span className={styles.noRowsBottomLine}>
            <span className={styles.noRowsTopLine}>
              <span className={styles.buttonAppearance}>No baseline characteristics defined</span></span>
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
      
      const handleRightPanelChange = (viewType: any, extraData: any, isCollapsed: boolean) => {
        
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
        handleRightPanelChange(currentViewType, currentExtraData, true); // Assume collapsed initially
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
      <div className={styles.gridContainer}>
        <ErrorBoundary>
          <AgGridWithCustomScrollbars
            scrollbarConfig={{horizontal: {marginRight: 35 ,marginLeft: 600, marginToEnd:100}, vertical: { marginToEnd:20}}}
            hideScrollbars={hideScrollbars}
            hideVerticalScrollbar={hideVerticalScrollbar}
            hideHorizontalScrollbar={true}
            key={currentlyViewing} // This will force a complete re-render when currentlyViewing changes
            ref={ref}
            noRowsOverlayComponent={NoRowsOverlayText()}
            rowData={data.rows}
            getRowId={(params) => params.data.id}
            theme={myTheme}
            onGridReady={onGridReady}
            headerHeight={headerHeight}
            columnDefs={data.columns.length > 0 ? data.columns : []}
            domLayout={domLayout}
            gridOptions = {gridOptions}
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
              // Refresh cells to update selection cell renderer
              if (ref && typeof ref === 'object' && ref.current?.api) {
                ref.current.api.refreshCells({ 
                  force: true,
                  columns: ['selection']
                });
              }
            }}
            onCellEditingStarted={() => {
              // Store the current selection before editing starts
              if (ref && typeof ref === 'object' && ref.current?.api) {
                const selectedNodes = ref.current.api.getSelectedNodes();
                selectedNodesBeforeEdit.current = selectedNodes;
              }
            }}
            onCellEditingStopped={() => {
              // Restore the selection after editing stops
              if (ref && typeof ref === 'object' && ref.current?.api && selectedNodesBeforeEdit.current.length > 0) {
                // Clear current selection
                ref.current.api.deselectAll();
                // Restore previous selection
                selectedNodesBeforeEdit.current.forEach((node: any) => {
                  const currentNode = ref.current.api.getRowNode(node.id);
                  if (currentNode) {
                    currentNode.setSelected(true);
                  }
                });
                // Clean up the stored selection
                selectedNodesBeforeEdit.current = [];
              }
            }}
            suppressRowDeselection={true}
            suppressColumnVirtualisation={true}
            onCellValueChanged={handleCellValueChanged}
            onRowDragEnd={handleRowDragEnd}
            onRangeSelectionChanged={() => {
            }}
            rowDragManaged={true}
            loadThemeGoogleFonts={true}
            animateRows={true}
            getRowHeight={customGetRowHeight || (params => {
              // Calculate height of CODELISTS
              let current_max_height = 24;
              const minHeight = 24; 
              if (
                params.data?.class_name == 'CodelistPhenotype' &&
                params.data.codelist?.codelist
              ) {
                const numEntries = Object.keys(params.data.codelist.codelist).length;
                const codelist_phenotype_height = Math.max(minHeight, numEntries * 50 + 20); // Adjust row height based on number of codelist entries
                current_max_height = Math.max(current_max_height, codelist_phenotype_height);
              }

              // Calculate height of RELATIVE TIME RANGES
              if (
                params.data?.relative_time_range &&
                Array.isArray(params.data.relative_time_range)
              ) {
                const numEntries = params.data.relative_time_range.length;
                const time_range_phenotype_height = Math.max(minHeight, numEntries * 30 + 10); // Adjust row height based on number of entries
                current_max_height = Math.max(current_max_height, time_range_phenotype_height);
              }

           

              const nameCol = params.api.getColumnDef('name');
              if (!nameCol || !params.data?.name) return minHeight; // Increased minimum height
              const nameWidth = (nameCol.width - 100) || 100;
              const nameCharPerLine = Math.floor(nameWidth / 8);
              const nameLines = Math.ceil(params.data?.name.length / nameCharPerLine);
              const nameHeight = nameLines * 22 + 10; // 14px per line + padding
              if (!params.data?.description) {
                return Math.max(current_max_height, nameHeight); // Increased minimum height
              }
              const descriptionLines = params.data.description.split('\n').length;
              // if (descriptionLines.length === 0) {
              //   return Math.max(current_max_height, nameHeight); // Increased minimum height
              // }
              const descriptionHeight = descriptionLines * 20 + 5; // 12px per line + padding
              current_max_height = Math.max(current_max_height, nameHeight+descriptionHeight);
              
              return current_max_height; // Increased minimum height
            })}
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
