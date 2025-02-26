import { FC, useEffect, useState } from 'react';
import { GridComponent } from '../GridComponent/GridComponent';
import styles from './Tables.module.css';
import { TableData } from './tableTypes';
import { TableDataService, TableController } from '../../Table';

interface TableProps {
  data?: string;
  dataService: TableDataService;
  onCellValueChanged?: (event: any) => void;
  gridRef?: any;
}

export const Table: FC<TableProps> = ({
  dataService,
  onCellValueChanged,
  gridRef,
}) => {
  const [error, setError] = useState<string | null>(null);

  if (error) return <div className={styles.error}>{error}</div>;
  if (!dataService.table_data) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.tableAndHeader}>
      <div className={styles.table}>
        <GridComponent data={dataService.table_data} onCellValueChanged={onCellValueChanged} ref={gridRef} />
      </div>
    </div>
  );
};
