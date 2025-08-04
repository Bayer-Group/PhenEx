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
  onCellValueChanged?: (event: any) => void;
}

export const CohortTable = forwardRef<any, CohortTableProps>(
  ({ data, onCellValueChanged }, ref) => {
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

    useEffect(() => {
      if (ref.current?.api) {
        ref.current.api.resetRowHeights();
      }
    }, [data]);

    return (
      <div className={`ag-theme-quartz ${styles.gridContainer}`}>
        <ErrorBoundary>
          <AgGridReact
            ref={ref}
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
