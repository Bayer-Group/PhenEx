import React, { useRef } from 'react';
import styles from './PhenotypeRowActions.module.css';
import ArrowUpRightIcon from '../../../../components/icons/ArrowUpRightIcon';
import { PhenExNavBarMenu } from '../../../../components/PhenExNavBar/PhenExNavBarMenu';
import { useNavBarMenu } from '../../../../components/PhenExNavBar/PhenExNavBarMenuContext';

interface PhenotypeRowActionsProps {
  phenotypeId: string;
  isHovered: boolean;
  isDragging: boolean;
  onDelete: () => void;
  onExpand: () => void;
  onAdd: (type: string) => void;
  fontColor?: string;
}

const PHENOTYPE_TYPES = [
  { type: 'entry', label: 'Entry' },
  { type: 'inclusion', label: 'Inclusion' },
  { type: 'exclusion', label: 'Exclusion' },
  { type: 'baseline', label: 'Baseline Characteristic' },
  { type: 'outcome', label: 'Outcome' },
];

export const PhenotypeRowActions: React.FC<PhenotypeRowActionsProps> = ({
  phenotypeId,
  isHovered,
  isDragging,
  onDelete,
  onExpand,
  onAdd,
  fontColor,
}) => {
  const visible = isHovered && !isDragging;
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null!);
  const { isOpen: isAddMenuOpen, open: openAddMenu, close: closeAddMenu } = useNavBarMenu(
    `phenotype-row-add-${phenotypeId}`
  );

  const sharedStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
  };

  return (
    <>
      <div className={styles.actions}>
        {/* Delete */}
        <button
          className={`${styles.actionButton} ${styles.deleteButton} ${fontColor ?? ''}`}
          style={sharedStyle}
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
          onMouseDown={e => e.stopPropagation()}
          title="Delete phenotype"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>

        {/* Add */}
        <button
          ref={addButtonRef}
          className={`${styles.actionButton} ${isAddMenuOpen ? styles.menuOpen : ''}`}
          style={sharedStyle}
          onClick={e => {
            e.stopPropagation();
            isAddMenuOpen ? closeAddMenu() : openAddMenu();
          }}
          onMouseDown={e => e.stopPropagation()}
          title="Add phenotype"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Expand */}
        <button
          className={styles.actionButton}
          style={sharedStyle}
          onClick={e => {
            e.stopPropagation();
            onExpand();
          }}
          onMouseDown={e => e.stopPropagation()}
          title="Open phenotype"
        >
          <ArrowUpRightIcon size={12} strokeWidth={3.5} />
        </button>
      </div>

      <PhenExNavBarMenu
        isOpen={isAddMenuOpen}
        onClose={closeAddMenu}
        anchorElement={addButtonRef.current}
        menuRef={menuRef}
        verticalPosition="below"
        horizontalAlignment="left"
      >
        <div style={{ padding: '8px', minWidth: '180px' }}>
          <div className={styles.itemList}>
            {PHENOTYPE_TYPES.map(({ type, label }) => (
              <button
                key={type}
                className={styles.addMenuItem}
                onClick={() => onAdd(type)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </PhenExNavBarMenu>
    </>
  );
};
