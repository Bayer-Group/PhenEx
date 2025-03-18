import React from 'react';
import styles from './CountCellRenderer.module.css';

interface CountCellRendererProps extends PhenexCellRendererProps {
  value: number;
}

const CountCellRenderer: React.FC<CountCellRendererProps> = props => {
  if (!props.value || isNaN(props.value)) {
    return <span className={styles.countValue}>NA</span>;
  }

  const formattedNumber = new Intl.NumberFormat('en-US').format(props.value);

  return (
      <span className={styles.countValue}>{formattedNumber}</span>
  );
};

export default CountCellRenderer;