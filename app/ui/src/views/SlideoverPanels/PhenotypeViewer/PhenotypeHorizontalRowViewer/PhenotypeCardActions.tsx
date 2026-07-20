import React, { useRef, useState } from 'react';
import styles from './PhenotypeCardActions.module.css';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { PhenotypeDataService } from '../PhenotypeDataService';

interface PhenotypeCardActionsProps {
  phenotypeId: string;
  onDelete: () => void;
  onClose: () => void;
}

export const PhenotypeCardActions: React.FC<PhenotypeCardActionsProps> = ({
  phenotypeId,
  onDelete,
  onClose,
}) => {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [showAddTooltip, setShowAddTooltip] = useState(false);

  const handleAddComponent = (e: React.MouseEvent) => {
    e.stopPropagation();
    PhenotypeDataService.getInstance().addNewComponentPhenotype();
  };

  return (
    <div className={styles.actions}>
      <button
        className={`${styles.actionButton} ${styles.deleteButton}`}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete phenotype"
      >
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>

      <button
        ref={addButtonRef}
        className={styles.actionButton}
        onClick={handleAddComponent}
        onMouseEnter={() => setShowAddTooltip(true)}
        onMouseLeave={() => setShowAddTooltip(false)}
      >
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <PhenExNavBarTooltip
        isVisible={showAddTooltip}
        anchorElement={addButtonRef.current}
        label="Add a component phenotype."

        verticalPosition="below"
        horizontalAlignment="center"
        gap={6}
        delay={400}
      />

      <button
        className={styles.actionButton}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Close"
      >
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

PhenotypeCardActions.displayName = 'PhenotypeCardActions';
