import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { InfoPortal } from '../../../components/Portal/InfoPortal';
import styles from './CohortCardHeaderCell.module.css';
import parametersInfoRaw from '/assets/parameters_info.json?raw';

const parametersInfo: Record<string, { description?: string }> = JSON.parse(parametersInfoRaw);

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------
export interface HeaderCellProps {
  colDef: {
    field: string;
    headerName?: string;
    width?: number;
    flex?: number;
  };
  /** When true the info button is always visible, not just on header-row hover. */
  showInfo?: boolean;
}

// ---------------------------------------------------------------------------
// Generic header cell
// ---------------------------------------------------------------------------
export const CohortCardHeaderCell: React.FC<HeaderCellProps> = ({ colDef, showInfo = false }) => {
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoOpacity, setInfoOpacity] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  const paramInfo = parametersInfo[colDef.field];
  const title = colDef.headerName ?? colDef.field;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleMouseEnter = () => {
    if (!paramInfo?.description) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setInfoVisible(true);
      setTimeout(() => setInfoOpacity(1), 10);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const handleHideRequest = () => {
    setInfoOpacity(0);
    setTimeout(() => setInfoVisible(false), 200);
  };

  const cellStyle: React.CSSProperties = {
    width: colDef.flex ? undefined : `${colDef.width ?? 150}px`,
    flex: colDef.flex ?? undefined,
  };

  // Portal width matches the column width exactly.
  const portalWidth = Math.max(cellRef.current?.offsetWidth ?? colDef.width ?? 150, 200);

  return (
    <div
      ref={cellRef}
      className={`${styles.headerCell} ${showInfo ? styles.showInfo : ''}`}
      style={cellStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={styles.title}>{title}</span>

      {/* {paramInfo?.description && (
        <span className={styles.infoButton}>i</span>
      )} */}

      { infoVisible && (
        <InfoPortal
          triggerRef={cellRef}
          position="below"
          alignment="left"
          offsetX={0}
          offsetY={-30}
          onHideRequest={handleHideRequest}
        >
          <div className={styles.infoPortal} style={{ opacity: infoOpacity, width: `${portalWidth}px` }}>
            <span className={styles.infoTitle}>{title}</span>
            <ReactMarkdown>{paramInfo!.description!}</ReactMarkdown>
          </div>
        </InfoPortal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Column-specific subclasses
// Register field-specific renderers here; falls back to CohortCardHeaderCell.
// ---------------------------------------------------------------------------

// Example of a column-specific renderer that extends the generic one:
// const CodelistHeaderCell: React.FC<HeaderCellProps> = (props) => (
//   <CohortCardHeaderCell {...props} showInfo />
// );

const headerCellRendererRegistry: Partial<Record<string, React.FC<HeaderCellProps>>> = {
  // codelist: CodelistHeaderCell,
};

export const resolveHeaderCellRenderer = (field: string): React.FC<HeaderCellProps> =>
  headerCellRendererRegistry[field] ?? CohortCardHeaderCell;

