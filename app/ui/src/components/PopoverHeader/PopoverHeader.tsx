import { FC } from 'react';
import styles from './PopoverHeader.module.css';
import { XButton } from '../ButtonsAndTabs/XButton/XButton';

interface PopoverHeader {
  onClick: () => void;
  title?: string; // for accessibility and tooltips
  className?: string;
  children?: React.ReactNode;
}

export const PopoverHeader: FC<PopoverHeader> = ({
  onClick,
  title = 'Close',
  className = '',
  children = undefined,
}) => {
  return (
    <div
      className={`${styles.popoverheader} ${className}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {!children && title}
      {children && <div className={styles.content}>{children}</div>}
      <XButton onClick={undefined} className={styles.xButton} />
    </div>
  );
};
