import { FC, forwardRef, ForwardedRef, useEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { RelativeTimeRangeFilterCellEditor } from './CellEditors/RelativeTimeRangeFilterCellEditor';
import { CodelistCellEditor } from './CellEditors/CodelistCellEditor';
import styles from './CohortTable.module.css';
import '../../../styles/variables.css';
import { themeQuartz } from 'ag-grid-community';
import NameCellRenderer from './CellRenderers/NameCellRenderer';
import TypeCellRenderer from './CellRenderers/TypeCellRenderer';
import DescriptionCellRenderer from './CellRenderers/DescriptionCellRenderer';
import CodelistCellRenderer from './CellRenderers/CodelistCellRenderer';
import DomainCellRenderer from './CellRenderers/DomainCellRenderer';
import CountCellRenderer from './CellRenderers/CountCellRenderer';
import DateRangeCellRenderer from './CellRenderers/DateRangeCellRenderer';

import RelativeTimeRangeCellRenderer from './CellRenderers/RelativeTimeRangeCellRenderer';

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
    // Process column definitions to add cell renderer for type column
    const processedColumnDefs =
      (data.columns ?? [])
        .map((col): ColDef<TableRow> | ColGroupDef<TableRow> => {
          if (!col) return {} as ColDef<TableRow>;
          const baseCol = {
            ...col,
            suppressHeaderMenuButton: false,
            sortable: true,
            filter: true,
          };
          if (col.field === 'type') {
            return {
              ...baseCol,
              cellRenderer: TypeCellRenderer,
              editable: true,
              cellEditor: 'agSelectCellEditor',
              cellEditorParams: {
                values: ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'],
              },
            } as ColDef<TableRow>;
          } else if (col.field === 'description') {
            return {
              ...baseCol,
              cellRenderer: DescriptionCellRenderer,
              editable: true,
            } as ColDef<TableRow>;
          } else if (col.field === 'count') {
            return {
              ...baseCol,
              cellRenderer: CountCellRenderer,
            } as ColDef<TableRow>;
          }else if (col.field === 'relative_time_range') {
            return {
              ...baseCol,
              cellRenderer: RelativeTimeRangeCellRenderer,
              editable: params => {
                console.log("CHECKING EDITABLE", params.data)
                return (
                  params.data.type !== 'entry' && 
                  (params.data.class_name === 'MeasurementPhenotype' ||
                  params.data.class_name === 'CodelistPhenotype')
                );
              },
            } as ColDef<TableRow>;
          } else if (col.field === 'name') {
            return {
              ...baseCol,
              cellRenderer: NameCellRenderer,
              editable: true,
            } as ColDef<TableRow>;
          } else if (col.field === 'date_range') {
            return {
              ...baseCol,
              cellRenderer: DateRangeCellRenderer,
              editable: false,
            } as ColDef<TableRow>;
          }else if (col.field === 'domain') {
            return {
              ...baseCol,
              cellRenderer: DomainCellRenderer,
              editable: true,
            } as ColDef<TableRow>;
          } else if (col.field === 'codelist') {
            return {
              ...baseCol,
              cellRenderer: CodelistCellRenderer,
              cellEditor: CodelistCellEditor,
              editable: params => {
                return (
                  params.data.class_name === 'MeasurementPhenotype' ||
                  params.data.class_name === 'CodelistPhenotype'
                );
              },
              valueParser: params => {
                // this is required for codelist cell editor return value type
                // as data types returned are variable (i.e. if codelist present vs not)
                // TODO add value validation here
                if (
                  params.newValue &&
                  typeof params.newValue === 'object' &&
                  params.newValue.class_name === 'Codelist'
                ) {
                  return params.newValue;
                }
                return params.oldValue;
              },
            } as ColDef<TableRow>;
          }
          return baseCol as ColDef<TableRow>;
        })
        .filter(Boolean) || [];

    const myTheme = themeQuartz.withParams({
      accentColor: '#DDDDDD',
      borderColor: '#AFAFAF26',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 14,
      headerRowBorder: true,
      headerBackgroundColor: 'var(--background-color-content, #FFFFFF)',
      rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
    });

    return (
      <div
        className={`ag-theme-quartz ${styles.gridContainer}`}
        style={{ height: '100%', width: '100%' }}
      >
        <AgGridReact
          ref={ref}
          rowData={data.rows}
          theme={myTheme}
          columnDefs={processedColumnDefs.length > 0 ? processedColumnDefs : []} // Ensure non-null column definitions
          components={{
            RelativeTimeRangeFilterCellEditor: RelativeTimeRangeFilterCellEditor,
            NameCellRenderer: NameCellRenderer,
            CodelistCellEditor: CodelistCellEditor,
            CodelistCellRenderer: CodelistCellRenderer,
          }}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            menuTabs: ['filterMenuTab'],
            suppressHeaderMenuButton: true, // Disable header menu button until columns are properly initialized
          }}
          suppressColumnVirtualisation={true}
          onCellValueChanged={onCellValueChanged}
          loadThemeGoogleFonts={true}
          // editType="fullRow"
          animateRows={true}
          getRowHeight={params => {
            
            // Calculate height of CODELISTS
            let current_max_height = 48;
            if (params.data?.class_name == 'CodelistPhenotype' && params.data.codelist?.codelist) {
              const numEntries = Object.keys(params.data.codelist.codelist).length;
              const codelist_phenotype_height = Math.max(48, numEntries * 50 + 20); // Adjust row height based on number of codelist entries
              current_max_height = Math.max(current_max_height, codelist_phenotype_height);
            }
  
            // Calculate height of RELATIVE TIME RANGES
            if (params.data?.relative_time_range) {
              const numEntries = params.data.relative_time_range.length;
              const time_range_phenotype_height = Math.max(48, numEntries * 30 + 20); // Adjust row height based on number of codelist entries
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
      </div>
    );
  }
);
