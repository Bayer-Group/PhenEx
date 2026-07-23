import { FC, useState, useRef, useEffect } from 'react';
import { exportStudy } from '@/api/text_to_cohort/route';
import styles from './ExportButton.module.css';

interface ExportButtonProps {
  studyId: string | null;
  className?: string;
}

export const ExportButton: FC<ExportButtonProps> = ({ studyId, className = '' }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleExport = async (format: 'py' | 'ipynb') => {
    if (!studyId || isExporting) return;
    
    setIsExporting(true);
    setIsMenuOpen(false);
    
    try {
      await exportStudy(studyId, format);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export study. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!studyId) {
    return null;
  }

  return (
    <div className={`${styles.container} ${className}`} ref={menuRef}>
      <button
        className={styles.exportButton}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        disabled={isExporting}
        title="Export study"
      >
        <svg
          className={styles.icon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className={styles.label}>
          {isExporting ? 'Exporting...' : 'Export'}
        </span>
        <svg
          className={styles.chevron}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {isMenuOpen && (
        <div className={styles.menu}>
          <button
            className={styles.menuItem}
            onClick={() => handleExport('py')}
          >
            <svg
              className={styles.menuIcon}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div className={styles.menuItemContent}>
              <span className={styles.menuItemTitle}>Python Script</span>
              <span className={styles.menuItemDesc}>Export as .py file</span>
            </div>
          </button>
          <button
            className={styles.menuItem}
            onClick={() => handleExport('ipynb')}
          >
            <svg
              className={styles.menuIcon}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <div className={styles.menuItemContent}>
              <span className={styles.menuItemTitle}>Jupyter Notebook</span>
              <span className={styles.menuItemDesc}>Export as .ipynb file</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
