import { FC, ReactNode, useRef } from 'react';
import styles from './ReportNavPanel.module.css';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar';

interface ReportNavPanelProps {
  top?: ReactNode;
  center?: ReactNode;
  bottom?: ReactNode;
  hidden?: boolean;
}

export const ReportNavPanel: FC<ReportNavPanelProps> = ({ top, center, bottom, hidden = false }) => {
  const centerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`${styles.panel} ${hidden ? styles.panelHidden : ''}`}>
      <div className={styles.top}>{top}</div>
      <div className={styles.centerWrapper}>
        <div className={styles.center} ref={centerRef}>
          {center}
        </div>
        <SimpleCustomScrollbar targetRef={centerRef} marginTop={30} marginBottom={30} marginToEnd={-3}/>
      </div>
      <div className={styles.bottom}>{bottom}</div>
    </div>
  );
};
