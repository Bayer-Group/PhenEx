import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from '../../components/Modal/Modal';
import {
  getStudiesWithExecutions,
  importTLFStudy,
  StudyWithExecution,
} from '@/api/text_to_cohort/route';
import styles from './TLFIntakeWizard.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'choose' | 'select-study' | 'upload-folder';

interface TLFIntakeWizardProps {
  isVisible: boolean;
  onClose: () => void;
  /** Called with the resolved study_id once the user is ready to proceed. */
  onFinish: (studyId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TLFIntakeWizard: FC<TLFIntakeWizardProps> = ({
  isVisible,
  onClose,
  onFinish,
}) => {
  const [mode, setMode] = useState<Mode>('choose');

  // Select-study state
  const [studyList, setStudyList] = useState<StudyWithExecution[]>([]);
  const [loadingStudies, setLoadingStudies] = useState(false);
  const [selectedStudyId, setSelectedStudyId] = useState('');

  // Upload-folder state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [studyName, setStudyName] = useState('');
  const [studyDescription, setStudyDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const folderInputRef = useRef<HTMLInputElement>(null);

  // Reset when modal opens
  useEffect(() => {
    if (isVisible) {
      setMode('choose');
      setSelectedStudyId('');
      setUploadedFiles([]);
      setStudyName('');
      setStudyDescription('');
      setUploadError('');
    }
  }, [isVisible]);

  // Load studies when user picks that path
  useEffect(() => {
    if (mode !== 'select-study') return;
    setLoadingStudies(true);
    getStudiesWithExecutions()
      .then(setStudyList)
      .catch(console.error)
      .finally(() => setLoadingStudies(false));
  }, [mode]);

  // Auto-derive study name from folder
  useEffect(() => {
    if (!studyName && uploadedFiles.length > 0) {
      const firstPath = (uploadedFiles[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath;
      if (firstPath) {
        const top = firstPath.split('/')[0];
        setStudyName(top.replace(/_/g, ' ').replace(/-/g, ' '));
      }
    }
  }, [uploadedFiles, studyName]);

  const handleFolderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;
      setUploadedFiles(Array.from(fileList));
      setStudyName(''); // let the useEffect re-derive
      setUploadError('');
    },
    [],
  );

  const handleSelectStudyProceed = () => {
    if (!selectedStudyId) return;
    onFinish(selectedStudyId);
    onClose();
  };

  const handleUploadProceed = async () => {
    if (uploadedFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      const { study_id } = await importTLFStudy(uploadedFiles, studyName, studyDescription);
      onFinish(study_id);
      onClose();
    } catch (err: any) {
      setUploadError(err?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isVisible={isVisible} onClose={onClose}>
      <div className={styles.wizardContent}>

        {/* ── Choose mode ─────────────────────────────────────── */}
        {mode === 'choose' && (
          <>
            <h2 className={styles.title}>Review TLFs</h2>
            <p className={styles.subtitle}>
              How would you like to provide your study results?
            </p>

            <div className={styles.modeCards}>
              <button
                className={styles.modeCard}
                onClick={() => setMode('select-study')}
              >
                <div className={styles.modeCardIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M3 5v5c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                    <path d="M3 10v5c0 1.66 4.03 3 9 3s9-1.34 9-3v-5" />
                  </svg>
                </div>
                <div className={styles.modeCardText}>
                  <strong>Select a PhenEx study</strong>
                  <span>Pick from studies that have already been executed in PhenEx.</span>
                </div>
                <span className={styles.modeCardArrow}>→</span>
              </button>

              <button
                className={styles.modeCard}
                onClick={() => setMode('upload-folder')}
              >
                <div className={styles.modeCardIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.93a1 1 0 0 1-.88-.53l-.9-1.94A1 1 0 0 0 9.41 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z" />
                    <path d="M12 11v6" />
                    <path d="m9 14 3-3 3 3" />
                  </svg>
                </div>
                <div className={styles.modeCardText}>
                  <strong>Upload a results folder</strong>
                  <span>Bring in results from a study executed outside of PhenEx.</span>
                </div>
                <span className={styles.modeCardArrow}>→</span>
              </button>
            </div>
          </>
        )}

        {/* ── Select existing study ───────────────────────────── */}
        {mode === 'select-study' && (
          <>
            <button className={styles.backBtn} onClick={() => setMode('choose')}>
              ← Back
            </button>
            <h2 className={styles.title}>Select a study</h2>
            <p className={styles.subtitle}>
              Only studies with at least one successful execution run are shown.
            </p>

            {loadingStudies ? (
              <div className={styles.loading}>Loading studies…</div>
            ) : studyList.length === 0 ? (
              <div className={styles.emptyState}>
                No studies with completed execution runs found.
              </div>
            ) : (
              <div className={styles.studyList}>
                {studyList.map((s) => (
                  <button
                    key={s.study_id}
                    className={`${styles.studyRow} ${selectedStudyId === s.study_id ? styles.studyRowSelected : ''}`}
                    onClick={() => setSelectedStudyId(s.study_id)}
                  >
                    <span className={styles.studyRowName}>{s.study_name}</span>
                    {s.executed_at && (
                      <span className={styles.studyRowDate}>
                        Last run {new Date(s.executed_at).toLocaleDateString()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                className={styles.primaryBtn}
                disabled={!selectedStudyId}
                onClick={handleSelectStudyProceed}
              >
                Open study →
              </button>
            </div>
          </>
        )}

        {/* ── Upload folder ───────────────────────────────────── */}
        {mode === 'upload-folder' && (
          <>
            <button className={styles.backBtn} onClick={() => setMode('choose')}>
              ← Back
            </button>
            <h2 className={styles.title}>Upload results folder</h2>
            <p className={styles.subtitle}>
              Select the folder containing your study output files (CSVs, figures, etc.).
              PhenEx will analyse the contents and create a study manifest automatically.
            </p>

            {/* Folder picker */}
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore – non-standard but widely supported
              webkitdirectory=""
              multiple
              className={styles.hiddenInput}
              onChange={handleFolderChange}
            />

            <button
              className={styles.folderPickerBtn}
              onClick={() => folderInputRef.current?.click()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.93a1 1 0 0 1-.88-.53l-.9-1.94A1 1 0 0 0 9.41 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z" />
              </svg>
              {uploadedFiles.length > 0
                ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} selected`
                : 'Choose folder…'}
            </button>

            {/* File preview */}
            {uploadedFiles.length > 0 && (
              <div className={styles.filePreview}>
                {uploadedFiles.slice(0, 8).map((f, i) => {
                  const rel = (f as any).webkitRelativePath || f.name;
                  return (
                    <div key={i} className={styles.filePreviewRow}>
                      <span className={styles.fileIcon}>{fileIcon(f.name)}</span>
                      <span className={styles.filePath}>{rel}</span>
                    </div>
                  );
                })}
                {uploadedFiles.length > 8 && (
                  <div className={styles.filePreviewMore}>
                    +{uploadedFiles.length - 8} more files
                  </div>
                )}
              </div>
            )}

            {/* Study name */}
            <label className={styles.fieldLabel}>Study name</label>
            <input
              className={styles.textInput}
              value={studyName}
              onChange={(e) => setStudyName(e.target.value)}
              placeholder="e.g. ATLAS Cohort 2024"
            />

            {/* Description */}
            <label className={styles.fieldLabel}>Description <span className={styles.optional}>(optional)</span></label>
            <textarea
              className={styles.textarea}
              value={studyDescription}
              onChange={(e) => setStudyDescription(e.target.value)}
              placeholder="Brief description of the study or data source…"
              rows={3}
            />

            {uploadError && <div className={styles.errorMsg}>{uploadError}</div>}

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                className={styles.primaryBtn}
                disabled={uploadedFiles.length === 0 || !studyName.trim() || uploading}
                onClick={handleUploadProceed}
              >
                {uploading ? 'Uploading…' : 'Import & review →'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['csv', 'xlsx', 'xls'].includes(ext)) return '📊';
  if (['png', 'jpg', 'svg', 'pdf'].includes(ext)) return '🖼';
  if (['json'].includes(ext)) return '{}';
  return '📄';
}
