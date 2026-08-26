import React, { useRef, useState, DragEvent } from 'react';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { importCohort } from '../../../api/text_to_cohort/route';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import styles from './ImportPanel.module.css';

interface ImportPanelProps {
  showTitle?: boolean;
  /**
   * Optional override for file handling. When omitted, the panel imports the
   * selected .json file as a cohort into the current study and reloads it.
   */
  onFileImport?: (files: FileList) => void;
}

type ImportStatus = { type: 'idle' | 'importing' | 'success' | 'error'; message?: string };

export const ImportPanel: React.FC<ImportPanelProps> = ({ showTitle = true, onFileImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<ImportStatus>({ type: 'idle' });

  const importCohortFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      setStatus({ type: 'error', message: 'Please select a .json file.' });
      return;
    }

    const studyDataService = StudyDataService.getInstance();
    const studyId = studyDataService.study_data?.id;
    if (!studyId) {
      setStatus({ type: 'error', message: 'Open a study before importing a cohort.' });
      return;
    }

    setStatus({ type: 'importing', message: `Importing ${file.name}...` });
    try {
      const result = await importCohort(studyId, file);
      await studyDataService.reloadStudy();
      setStatus({ type: 'success', message: `Imported "${result.name}".` });
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'Failed to import cohort.';
      setStatus({ type: 'error', message: detail });
    }
  };

  const handleFiles = (files: FileList) => {
    if (files.length === 0) return;
    if (onFileImport) {
      onFileImport(files);
      return;
    }
    void importCohortFile(files[0]);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <SlideoverPanel title="Import" info={undefined} showTitle={showTitle}>
      <div className={styles.content}>
        <div
          className={`${styles.dropArea} ${isDragging ? styles.dragging : ''}`}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && handleClick()}
          aria-label="Click or drag a .json file to import a cohort"
        >
          <span className={styles.dropText}>
            {status.type === 'importing' ? 'importing...' : 'click to import a cohort (.json)'}
          </span>
        </div>
        {status.message && status.type !== 'importing' && (
          <div className={status.type === 'error' ? styles.statusError : styles.statusSuccess}>
            {status.message}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className={styles.hiddenInput}
          onChange={handleFileInputChange}
        />
      </div>
    </SlideoverPanel>
  );
};
