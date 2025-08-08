import { FC, forwardRef, ForwardedRef, useEffect, useRef, Component } from 'react';
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
import { ColDef, ColGroupDef } from '@ag-grid-community/core';

// Register AG Grid Modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

interface CohortTableProps {
  data: TableData;
  currentlyViewing:string;
  onCellValueChanged?: (event: any) => void;
}

export const CohortTable = forwardRef<any, CohortTableProps>(
  ({ data, currentlyViewing, onCellValueChanged }, ref) => {
    const myTheme = themeQuartz.withParams({
      accentColor: '#FF00000',
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
      ref.current?.api?.resetRowHeights();
    };

    const NoRowsOverlayOutcomes: FC = () => {
      console.log("CALLING NO ROWS OUTCOMMMMMESSSSS", currentlyViewing, currentlyViewing==='outcome')
      return (
        <div className={styles.noRowsOverlay}>

          <span className={styles.noRowsBottomLine}>
            <span className={styles.noRows_section}>How do you want to assess post-index data?</span> 
          <br></br>
            <span className={styles.noRowsTopLine}>
            Click <span className={styles.buttonAppearance}>Add Phenotype</span> in the action bar above to add <span className={styles.noRows_section}>outcome phenotypes</span>.
          </span>
          <br></br>
             <span className = {styles.noRowsCommentLine}>PhenEx can then perform <span className={styles.noRows_action}>time-to-event</span> and <span className={styles.noRows_action}>treatment pattern</span> analyses for you.</span>
          </span>
        </div>
      );
    };

    const NoRowsOverlayText = () => {
      if (currentlyViewing === 'outcomes'){
        return NoRowsOverlayOutcomes;
      } else if (currentlyViewing === 'baseline'){
        return NoRowsOverlayCharacteristics;
      }
      return NoRowsOverlayCohort;

    }
    const NoRowsOverlayCohort: FC = () => {

      return (
        <div className={styles.noRowsOverlay}>

          <span className={styles.noRowsBottomLine}>
            <span className={styles.noRows_section}>How do you want to define your cohort?</span> 
          <br></br>
            <span className={styles.noRowsTopLine}>
            Click <span className={styles.buttonAppearance}>Add Phenotype</span> in the action bar above to add 
              <ol>
                <li>the cohort <span className={styles.noRows_section}>entry</span> criterion, which defines  <span className={styles.noRows_section}>index date</span></li>
                <li><span className={styles.noRows_section}>inclusion</span> criteria, which all patients must fulfill</li>
                <li><span className={styles.noRows_section}>exclusion</span> criteria, which patients may not fulfill</li>
              </ol>
          </span>
          <br></br>
             <span className = {styles.noRowsCommentLine}>PhenEx can then generate your <span className={styles.noRows_action}>cohort</span> for you.</span>
          </span>
        </div>
      );
    };
    const NoRowsOverlayCharacteristics: FC = () => {

      return (
        <div className={styles.noRowsOverlay}>

          <span className={styles.noRowsBottomLine}>
            <span className={styles.noRows_section}>How do you want to assess patients at index date?</span> 
          <br></br>
            <span className={styles.noRowsTopLine}>
            Click <span className={styles.buttonAppearance}>Add Phenotype</span> in the action bar above to add <span className={styles.noRows_section}>baseline phenotypes</span>.
          </span>
          <br></br>
             <span className = {styles.noRowsCommentLine}>PhenEx can then create <span className={styles.noRows_action}>Table 1</span> for you.</span>
          </span>
        </div>
      );
    };

    useEffect(() => {
      if (ref.current?.api) {
        ref.current.api.resetRowHeights();
      }
    }, [data]);

    return (
      <div className={`ag-theme-quartz ${styles.gridContainer}`}>
        <ErrorBoundary>
          <AgGridReact
            key={currentlyViewing} // This will force a complete re-render when currentlyViewing changes

            ref={ref}
            noRowsOverlayComponent={
              NoRowsOverlayText()
            }  
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
            loadThemeGoogleFonts={true}
            animateRows={false}
            animateColumns={false}
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
