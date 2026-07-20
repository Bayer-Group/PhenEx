import React from 'react';
import { createPortal } from 'react-dom';
import styles from './DeleteConfirmModal.module.css';

interface DeleteConfirmModalProps {
  name: string;
  entityName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ name, entityName = 'Phenotype', onConfirm, onCancel }) => {
  return createPortal(
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.alertModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.alertIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className={styles.alertTitle}>Delete {entityName}?</h3>
        <p className={styles.alertMessage}>
          Are you sure you want to delete <strong>"{name}"</strong>?
        </p>
        <p className={styles.alertWarning}>
          This action cannot be undone.
        </p>
        <div className={styles.alertActions}>
          <button className={styles.alertCancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.alertDeleteButton} onClick={onConfirm}>
            Delete {entityName}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
