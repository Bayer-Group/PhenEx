import React from 'react';
import styles from './CohortCardActions.module.css';

interface CohortCardActionsProps {
  cohortId: string;
  mouseY: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const CohortCardActions: React.FC<CohortCardActionsProps> = ({
  cohortId,
  mouseY,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      className={styles.cohortCardActionsContainer}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        right: 'calc(-60px / var(--zoom-scale))',
        top: `${mouseY}px`,
        transform: 'translateY(-50%)',
        transition: 'top 0.15s ease-out',
        display: 'flex',
        flexDirection: 'column',
        gap: 'calc(8px / var(--zoom-scale))',
        pointerEvents: 'auto',
      }}
    >
      <button
        className={styles.actionButton}
        onClick={(e) => {
          e.stopPropagation();
          console.log('Duplicate cohort:', cohortId);
        }}
        aria-label="Duplicate cohort"
        title="Duplicate cohort"
        style={{ 
          fontSize: 'var(--dynamic-font-size)',
          width: 'var(--dynamic-arrow-size)',
          height: 'var(--dynamic-arrow-size)',
        }}
      >
        📋
      </button>
      <button
        className={styles.actionButton}
        onClick={(e) => {
          e.stopPropagation();
          console.log('Delete cohort:', cohortId);
        }}
        aria-label="Delete cohort"
        title="Delete cohort"
        style={{ 
          fontSize: 'var(--dynamic-font-size)',
          width: 'var(--dynamic-arrow-size)',
          height: 'var(--dynamic-arrow-size)',
        }}
      >
        🗑️
      </button>
      <button
        className={styles.actionButton}
        onClick={(e) => {
          e.stopPropagation();
          console.log('Settings for cohort:', cohortId);
        }}
        aria-label="Cohort settings"
        title="Cohort settings"
        style={{ 
          fontSize: 'var(--dynamic-font-size)',
          width: 'var(--dynamic-arrow-size)',
          height: 'var(--dynamic-arrow-size)',
        }}
      >
        ⚙️
      </button>
    </div>
  );
};
