import { FC, forwardRef, ForwardedRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import styles from './GridComponent.module.css';
import '../../../styles/variables.css';
import { themeQuartz } from 'ag-grid-community';
import { ModuleRegistry } from '@ag-grid-community/core';

import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { TableData, TableRow } from '../Tables/tableTypes';
import { ColDef, ColGroupDef } from '@ag-grid-community/core';

// Register AG Grid Modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

interface GridComponentProps {
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
  return <div style={{ textAlign: 'left', lineHeight: '20px', marginTop: '10px' }}>{type}</div>;
};

export const GridComponent = forwardRef<any, GridComponentProps>(
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
            } as ColDef<TableRow>;
          } else if (col.field === 'description') {
            return {
              ...baseCol,
              cellRenderer: DescriptionCellRenderer,
            } as ColDef<TableRow>;
          }
          return baseCol as ColDef<TableRow>;
        })
        .filter(Boolean) || [];

    const myTheme = themeQuartz.withParams({
      accentColor: '#FF0000',
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
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            menuTabs: [ 'filterMenuTab'],
          }}
          suppressColumnVirtualisation={true}
          onCellValueChanged={onCellValueChanged}
          loadThemeGoogleFonts={true}
          // editType="fullRow"
          animateRows={true}
          getRowHeight={params => {
            const descriptionCol = params.api.getColumnDef('description');
            if (!descriptionCol || !params.data.description) return 40;

            const descWidth = descriptionCol.actualWidth || 500;
            const charPerLine = Math.floor(descWidth / 8);
            const lines = Math.ceil(params.data.description.length / charPerLine);
            return Math.max(40, lines * 18 + 10); // Reduced line height and padding
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
