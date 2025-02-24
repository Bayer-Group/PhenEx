import { FC, useEffect, useState } from 'react';
import { GridComponent } from '../GridComponent/GridComponent';
import styles from './Tables.module.css';
import { TableData } from './tableTypes';
import { TableDataService, TableController } from '../../Table';

interface TableProps {
  data?: string;
  title?: string;
  dataService: TableDataService;
  onCellValueChanged?: (event: any) => void;
  gridRef?: any;
}

export const Table: FC<TableProps> = ({
  data,
  dataService,
  onCellValueChanged,
  title,
  gridRef,
}) => {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const parsedData = await dataService.fetchTableData();
        setTableData(parsedData);
      } catch (err) {
        setError('Error loading table data');
        console.error(err);
      }
    };

    fetchData();
  }, [data]);

  if (error) return <div className={styles.error}>{error}</div>;
  if (!tableData) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.tableAndHeader}>
      <div className={styles.table}>
        <GridComponent data={tableData} onCellValueChanged={onCellValueChanged} ref={gridRef} />
      </div>
    </div>
  );
};
