import { FC, useRef } from 'react';
import { ReportDataService } from './ReportDataService';
import styles from './ReportTable.module.css';
import { AgGridReact } from '@ag-grid-community/react';
import { themeQuartz } from 'ag-grid-community';

interface ReportTableProps {
  dataService: ReportDataService;
}

export const ReportTable: FC<ReportTableProps> = ({ dataService }) => {
  const gridRef = useRef<any>(null);

  const theme = themeQuartz.withParams({
    accentColor: '#DDDDDD',
    borderColor: 'var(--line-color-grid)',
    browserColorScheme: 'light',
    columnBorder: true,
    headerFontSize: 11,
    headerRowBorder: true,
    cellHorizontalPadding: 10,
    fontSize: 11,
    headerBackgroundColor: 'var(--background-color, red)',
    rowBorder: true,
    spacing: 3,
    wrapperBorder: false,
    backgroundColor: 'var(--background-color)',
  });

  return (
    <div className={styles.gridContainer}>
      <AgGridReact
        ref={gridRef}
        rowData={dataService.row_data}
        columnDefs={dataService.columns}
        theme={theme}
        animateRows={true}
        defaultColDef={{
          flex: 1,
          minWidth: 100,
          resizable: true,
        }}
      />
    </div>
  );
};
