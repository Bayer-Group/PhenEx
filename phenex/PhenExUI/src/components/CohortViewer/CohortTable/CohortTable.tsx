import { FC, forwardRef, ForwardedRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { RelativeTimeRangeFilterCellEditor } from './CellEditors/RelativeTimeRangeFilterCellEditor';
import { CodelistCellEditor } from './CellEditors/CodelistCellEditor';
import styles from './CohortTable.module.css';
import '../../../styles/variables.css';
import { themeQuartz } from 'ag-grid-community';
import NameCellRenderer from './CellRenderers/NameCellRenderer';
import CodelistCellRenderer from './CellRenderers/CodelistCellRenderer';
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

// const NameCellRenderer = (props: any) => {
//   const type = props.value;
//   const colorClass = `rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-outer`;
//   return (
//     <div style={{ textAlign: 'right' }}>
//       <span
//         style={{
//           // display: 'inline-block',
//           padding: '5px 8px',
//           borderRadius: '8px',
//           backgroundColor: 'red',
//         }}
//         className={colorClass}
//       >
//         {type}
//       </span>
//     </div>
//   );
// };

const TypeCellRenderer = (props: any) => {
  const type = props.value;
  const colorClass = `rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-outer`;
  return (
    <div style={{ textAlign: 'right' }}>
      <span
        style={{
          // display: 'inline-block',
          padding: '5px 8px',
          borderRadius: '8px',
          backgroundColor: 'red',
        }}
        className={colorClass}
      >
        {type}
      </span>
    </div>
  );
};

const DescriptionCellRenderer = (props: any) => {
  const type = props.value;
  return (
    <div style={{ textAlign: 'left', lineHeight: '1em', marginTop: '10px', fontSize: '14px' }}>
      {type}
    </div>
  );
};

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
          } else if (col.field === 'name') {
            return {
              ...baseCol,
              cellRenderer: NameCellRenderer,
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
          columnDefs={processedColumnDefs}
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
          }}
          suppressColumnVirtualisation={true}
          onCellValueChanged={onCellValueChanged}
          loadThemeGoogleFonts={true}
          // editType="fullRow"
          animateRows={true}
          getRowHeight={params => {
            const descriptionCol = params.api.getColumnDef('description');
            if (!descriptionCol || !params.data?.description) return 48; // Increased minimum height
            const descWidth = descriptionCol.width || 250;
            const charPerLine = Math.floor(descWidth / 8);
            const lines = Math.ceil(params.data?.description.length / charPerLine);
            return Math.max(48, lines * 14 + 20); // Increased minimum height
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
