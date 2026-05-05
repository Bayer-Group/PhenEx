import { FC } from 'react';
import styles from './NameCellRenderer.module.css';

export const NameCellRenderer: FC<any> = (params) => {
  return <div className={styles.nameCell}>{params.value}</div>;
};
