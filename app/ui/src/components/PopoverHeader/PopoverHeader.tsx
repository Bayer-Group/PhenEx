import { FC } from 'react';
import styles from './PopoverHeader.module.css';
import { XButton } from '../ButtonsAndTabs/XButton/XButton';

interface PopoverHeader {
  onClick: (event?: React.MouseEvent) => void;
  title?: string; // for accessibility and tooltips
  className?: string;
  children?: React.ReactNode;
  classNameXButton?: string;
}

export const PopoverHeader: FC<PopoverHeader> = ({
  onClick,
  title = 'Close',
  className = '',
  children = undefined,
  classNameXButton = '',
}) => {
  return (
    <div
      className={`${styles.popoverheader} ${className} ${children && styles.hasChildren}`}
      onClick={event => onClick(event)}
      title={title}
      aria-label={title}
    >
      {!children && title}
      {children && <div className={styles.content}>{children}</div>}
      <XButton onClick={onClick} className={`${styles.xButton} ${classNameXButton}`} />
    </div>
  );
};
