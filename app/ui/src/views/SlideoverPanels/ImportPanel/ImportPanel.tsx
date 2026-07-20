import React, { useRef, useState, DragEvent } from 'react';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import styles from './ImportPanel.module.css';

interface ImportPanelProps {
  showTitle?: boolean;
  onFileImport?: (files: FileList) => void;
}

export const ImportPanel: React.FC<ImportPanelProps> = ({ showTitle = true, onFileImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList) => {
    if (files.length > 0) {
      onFileImport?.(files);
    }
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
          aria-label="Click or drag a file to import a cohort"
        >
          <span className={styles.dropText}>click to import a cohort</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className={styles.hiddenInput}
          onChange={handleFileInputChange}
          multiple
        />
      </div>
    </SlideoverPanel>
  );
};
