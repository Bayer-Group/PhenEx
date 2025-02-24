import { FC, useEffect, useState } from 'react';
import { GridComponent } from '../GridComponent/GridComponent';
import styles from './Tables.module.css';
import { DataService } from '../../../services/DataService';
import { GroupedTableData } from './tableTypes';

interface GroupedTableProps {
  data?: string;
}

export const GroupedTable: FC<GroupedTableProps> = ({ data }) => {
  const [groupedData, setGroupedData] = useState<GroupedTableData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // If data prop is provided, parse it, otherwise fetch from service
        const parsedData = data
          ? JSON.parse(data)
          : await DataService.getInstance().fetchGroupedTableData();
        setGroupedData(parsedData);
      } catch (err) {
        setError('Error loading grouped table data');
        console.error(err);
      }
    };

    fetchData();
  }, [data]);

  if (error) return <div className={styles.error}>{error}</div>;
  if (!groupedData) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.groupedTable}>
      <h2>Grouped Table</h2>
      {groupedData.groups.map(group => (
        <div key={group.id} className={styles.tableGroup}>
          <h3>{group.name}</h3>
          <div style={{ height: `${Math.max(60, group.data.rows.length * 48 + 60)}px` }}>
            <GridComponent data={group.data} />
          </div>
        </div>
      ))}
    </div>
  );
};
