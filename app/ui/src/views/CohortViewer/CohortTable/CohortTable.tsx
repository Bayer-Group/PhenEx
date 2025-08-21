import { FC, forwardRef, useEffect, Component } from 'react';
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
      console.log('=== handleRowDragEnd START ===');
      if (!onRowDragEnd) {
        console.log('No onRowDragEnd callback provided');
        return;
      }
      
      // Get the current order from the grid and update indices
      const newRowData: any[] = [];
      if (ref && typeof ref === 'object' && ref.current?.api) {
        ref.current.api.forEachNode((node: any) => {
          newRowData.push(node.data);
        });
      }
      
      console.log('Current row data from grid:', newRowData.map(r => ({ id: r.id, type: r.type, name: r.name, index: r.index })));
      console.log('Original data rows:', data.rows.map(r => ({ id: r.id, type: r.type, name: r.name, index: r.index })));
      
      // Simple validation: ensure we have data and all items have the required properties
      if (newRowData.length === 0) {
        console.log('No row data found, skipping drag operation');
        return;
      }

      // Validate that all rows have required properties
      const invalidRows = newRowData.filter(row => !row.id || !row.type);
      if (invalidRows.length > 0) {
        console.log('Invalid rows detected:', invalidRows);
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
      
      console.log('New grouped by type:', groupedByType);
      
      // Update indices within each type
      Object.keys(groupedByType).forEach(type => {
        groupedByType[type].forEach((phenotype, index) => {
          phenotype.index = index + 1;
        });
      });
      
      console.log('Calling onRowDragEnd with:', newRowData.map(r => ({ id: r.id, type: r.type, name: r.name, index: r.index })));
      // Call the parent callback with the reordered data
      onRowDragEnd(newRowData);
      console.log('=== handleRowDragEnd END ===');
    };

    const NoRowsOverlayOutcomes: FC = () => {
      return (
        <div className={styles.noRowsOverlay}>
          <span className={styles.noRowsBottomLine}>
            <span className={styles.noRows_section}>
              How do you want to assess post-index data?
            </span>
            <br></br>
            <span className={styles.noRowsTopLine}>
              Click <span className={styles.buttonAppearance}>Add Phenotype</span> in the action bar
              above to add <span className={styles.noRows_section}>outcome phenotypes</span>.
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
                    Click <span className={styles.buttonAppearance}>Add Component</span> in right above this table to add a component phenotype.
                  </li>
                  <li>
                    Component phenotypes can then be accessed by Composite Phenotypes such as LogicPhenotype, ScorePhenotype, ArithemticPhenotype, etc.
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
      } else if (currentlyViewing === 'components'){
        return NoRowsOverlayComponents;
      }
      return NoRowsOverlayCohort;
    };

    const NoRowsOverlayCohort: FC = () => {
      return (
        <div className={styles.noRowsOverlay}>
          <span className={styles.noRowsBottomLine}>
            <span className={styles.noRows_section}>How do you want to define your cohort?</span>
            <br></br>
            <span className={styles.noRowsTopLine}>
              Click <span className={styles.buttonAppearance}>Add Phenotype</span> in the action bar
              above to add :
              <ol>
                <li>
                  the cohort <span className={styles.noRows_section}>entry</span> criterion, which
                  defines the <span className={styles.noRows_section}>index date</span> for each
                  patient i.e. the study entry date.
                </li>
                <li>
                  <span className={styles.noRows_section}>inclusion</span> criteria, which all
                  patients must fulfill at index date.
                </li>
                <li>
                  <span className={styles.noRows_section}>exclusion</span> criteria, which patients
                  may not fulfill at index date.
                </li>
              </ol>
            </span>
            <br></br>
            <span className={styles.noRowsCommentLine}>
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
            <span className={styles.noRows_section}>
              How do you want to assess patients at index date?
            </span>
            <br></br>
            <span className={styles.noRowsTopLine}>
              Click <span className={styles.buttonAppearance}>Add Phenotype</span> in the action bar
              above to add <span className={styles.noRows_section}>baseline phenotypes</span>.
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
            suppressColumnVirtualisation={true}
            onCellValueChanged={onCellValueChanged}
            onRowDragEnd={handleRowDragEnd}
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
