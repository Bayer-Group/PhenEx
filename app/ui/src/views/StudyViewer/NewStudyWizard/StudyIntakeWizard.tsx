import { FC, useState, useRef, useCallback } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { StepMarker } from '../../../components/StepMarker/StepMarker';
import { parseStudyConcept, CohortIntake } from '@/api/text_to_cohort/route';
import styles from './StudyIntakeWizard.module.css';

// Load databases data
import databasesDataRaw from '/assets/databases.json?raw';
const databasesData = JSON.parse(databasesDataRaw);

// ── Types ────────────────────────────────────────────────────────────────────

export interface CodelistFileEntry {
  filename: string;
  rawCsv: string;
}

export interface StudyIntake {
  studyType: string;
  studyName: string;
  rawDescription: string;
  cohorts: CohortIntake[];
  codelistNotes: string;
  codelistFiles: CodelistFileEntry[];
  /** 'upload' | 'manual' */
  conceptMode: 'upload' | 'manual';
  /** Selected database name (study-wide default) */
  database: string;
  /** Selected schema (study-wide default) */
  schema: string;
  /** Whether to use per-cohort database (false = study-wide) */
  perCohortDatabase: boolean;
  /** Per-cohort database configurations */
  cohortDatabases: Record<string, { database: string; schema: string }>;
}

interface StudyIntakeWizardProps {
  isVisible: boolean;
  onClose: () => void;
  /** Called when the user chooses an action at the summary step. */
  onFinish: (intake: StudyIntake, action: 'shell' | 'ai') => Promise<void>;
  /** Skip the entire intake and create a blank study immediately. */
  onSkip?: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STEP_TITLES = ['Getting started', 'Study name', 'Cohorts', 'Codelists', 'Database', 'Summary'];

// ── Component ────────────────────────────────────────────────────────────────

export const StudyIntakeWizard: FC<StudyIntakeWizardProps> = ({
  isVisible,
  onClose,
  onFinish,
  onSkip,
}) => {
  const [step, setStep] = useState(0);

  // Step 0 – landing
  const [conceptMode, setConceptMode] = useState<'upload' | 'manual'>('upload');
  const [uploadedText, setUploadedText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 – name + description (may be pre-filled by AI)
  const [studyName, setStudyName] = useState('');
  const [rawDescription, setRawDescription] = useState('');

  // Step 2 – cohorts (may be pre-filled by AI)
  const [cohorts, setCohorts] = useState<CohortIntake[]>([
    { name: '', description: '', entry_criterion: '', inclusions: [''], exclusions: [''] },
  ]);

  // Step 3 – codelists
  const [codelistNotes, setCodelistNotes] = useState('');
  const [codelistFiles, setCodelistFiles] = useState<CodelistFileEntry[]>([]);
  const codelistInputRef = useRef<HTMLInputElement>(null);
  
  // Step 4 – database
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [perCohortDatabase, setPerCohortDatabase] = useState(false);
  const [cohortDatabases, setCohortDatabases] = useState<Record<string, { database: string; schema: string }>>({});
  
  // Step 5 – final action selection
  const [selectedAction, setSelectedAction] = useState<'shell' | 'ai' | null>('ai');
  
  // Final action
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetState = () => {
    setStep(0);
    setConceptMode('upload');
    setUploadedText('');
    setIsParsing(false);
    setParseError('');
    setStudyName('');
    setRawDescription('');
    setCohorts([{ name: '', description: '', entry_criterion: '', inclusions: [''], exclusions: [''] }]);
    setCodelistNotes('');
    setCodelistFiles([]);
    setSelectedDatabase('');
    setSelectedSchema('');
    setPerCohortDatabase(false);
    setCohortDatabases({});
    setSelectedAction(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fillEmptyCohortFields = (list: CohortIntake[]): CohortIntake[] =>
    list.map((c, i) => ({
      ...c,
      name: c.name.trim() || `Cohort ${i + 1}`,
      description: c.description.trim() || `Patient group ${i + 1}`,
    }));

  const intake: StudyIntake = {
    studyType: 'cohort',
    studyName,
    rawDescription,
    cohorts: fillEmptyCohortFields(cohorts).filter(c => c.name.trim()),
    codelistNotes,
    codelistFiles,
    conceptMode,
    database: selectedDatabase,
    schema: selectedSchema,
    perCohortDatabase,
    cohortDatabases,
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      setParseError('');
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'docx') {
        try {
          const mammoth = await import('mammoth');
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setUploadedText(result.value);
        } catch {
          setParseError('Could not extract text from .docx file.');
        }
      } else {
        const text = await file.text();
        setUploadedText(text);
      }
    },
    [],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleParseWithAI = async () => {
    if (!uploadedText.trim()) return;
    setIsParsing(true);
    setParseError('');
    try {
      const result = await parseStudyConcept(uploadedText, databasesData);
      if (result.study_name && !studyName) setStudyName(result.study_name);
      if (result.study_type) setStudyType(result.study_type);
      if (result.raw_description) setRawDescription(result.raw_description);
      if (result.cohorts.length > 0) {
        setCohorts(
          result.cohorts.map(c => ({
            ...c,
            inclusions: c.inclusions.length ? c.inclusions : [''],
            exclusions: c.exclusions.length ? c.exclusions : [''],
          })),
        );
      }
    } catch {
      setParseError('Failed to parse document. Please try again or define manually.');
    } finally {
      setIsParsing(false);
    }
  };

  // ── Cohort helpers ─────────────────────────────────────────────────────────

  const updateCohort = (idx: number, field: keyof CohortIntake, value: string | string[]) => {
    setCohorts(prev => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const updateListItem = (
    cohortIdx: number,
    field: 'inclusions' | 'exclusions',
    itemIdx: number,
    value: string,
  ) => {
    setCohorts(prev =>
      prev.map((c, i) => {
        if (i !== cohortIdx) return c;
        const list = [...c[field]];
        list[itemIdx] = value;
        return { ...c, [field]: list };
      }),
    );
  };

  const addListItem = (cohortIdx: number, field: 'inclusions' | 'exclusions') => {
    setCohorts(prev =>
      prev.map((c, i) => (i === cohortIdx ? { ...c, [field]: [...c[field], ''] } : c)),
    );
  };

  const removeListItem = (cohortIdx: number, field: 'inclusions' | 'exclusions', itemIdx: number) => {
    setCohorts(prev =>
      prev.map((c, i) => {
        if (i !== cohortIdx) return c;
        const list = c[field].filter((_, li) => li !== itemIdx);
        return { ...c, [field]: list.length ? list : [''] };
      }),
    );
  };

  const addCohort = () => {
    setCohorts(prev => [...prev, { name: '', description: '', entry_criterion: '', inclusions: [''], exclusions: [''] }]);
  };

  const removeCohort = (idx: number) => {
    if (cohorts.length === 1) return;
    setCohorts(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const canAdvance = () => {
    if (step === 0) return conceptMode === 'manual' || uploadedText.trim().length > 0;
    if (step === 1) return studyName.trim().length > 0;
    if (step === 2) return cohorts.some(c => c.entry_criterion.trim());
    if (step === 3) return true;
    if (step === 4) return true;
    if (step === 5) return selectedAction !== null;
    return true;
  };

  const handleNext = async () => {
    // AI parse: leaving the landing step in upload mode with text loaded
    if (step === 0 && conceptMode === 'upload' && uploadedText.trim() && !isParsing) {
      setIsParsing(true);
      setParseError('');
      try {
        const result = await parseStudyConcept(uploadedText, databasesData);
        if (result.study_name) setStudyName(result.study_name);
        if (result.raw_description) setRawDescription(result.raw_description);
        if (result.cohorts.length > 0) {
          setCohorts(
            result.cohorts.map(c => ({
              ...c,
              entry_criterion: c.entry_criterion || '',
              inclusions: c.inclusions.length ? c.inclusions : [''],
              exclusions: c.exclusions.length ? c.exclusions : [''],
            })),
          );
        }
        if (result.codelist_notes) setCodelistNotes(result.codelist_notes);
        if (result.database) setSelectedDatabase(result.database);
        if (result.schema) setSelectedSchema(result.schema);
      } catch {
        setParseError('Failed to parse document. Please try again or switch to manual.');
        setIsParsing(false);
        return;
      }
      setIsParsing(false);
    }
    
    // Final step: trigger the finish action
    if (step === 5 && selectedAction) {
      await handleFinish(selectedAction);
      return;
    }
    
    // Fill default cohort name/description before leaving the cohorts step
    if (step === 2) {
      setCohorts(fillEmptyCohortFields(cohorts));
    }

    if (step < STEP_TITLES.length - 1) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleFinish = async (action: 'shell' | 'ai') => {
    setIsSubmitting(true);
    try {
      await onFinish(intake, action);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Renders ────────────────────────────────────────────────────────────────

  // Step 0: landing — choose upload or manual
  const renderStep0 = () => (
    <div className={styles.stepBody}>
      <h3 className={`${styles.stepTitle} ${styles.stepTitleCentered}`}>How would you like to start?</h3>

      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeCard} ${conceptMode === 'upload' ? styles.modeCardSelected : ''}`}
          onClick={() => setConceptMode('upload')}
        >
          <span className={styles.modeCardIcon}>📄</span>
          <div>
            <p className={styles.modeCardTitle}>Upload a study concept document</p>
            <p className={styles.modeCardDesc}>AI will extract the name, description, cohorts and criteria from your document.</p>
          </div>
        </button>
        <button
          className={`${styles.modeCard} ${conceptMode === 'manual' ? styles.modeCardSelected : ''}`}
          onClick={() => setConceptMode('manual')}
        >
          <span className={styles.modeCardIcon}>✏️</span>
          <div>
            <p className={styles.modeCardTitle}>Define manually</p>
            <p className={styles.modeCardDesc}>Enter the study name, description, and cohort criteria yourself on the next steps.</p>
          </div>
        </button>
      </div>

      {conceptMode === 'upload' ? (
        <div className={styles.uploadSection}>
          <p className={styles.hint}>
            Upload your study concept (.docx, .txt, .md) or paste the text directly below. AI will extract
            the study name, description, and cohort criteria — you can review and edit on
            the next steps.
          </p>
          <div
            className={styles.dropzone}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadedText ? (
              <span className={styles.dropzoneLoaded}>
                ✓ Document loaded ({uploadedText.length.toLocaleString()} chars)
              </span>
            ) : (
              <span className={styles.dropzonePrompt}>
                Drop .docx / .txt / .md here, or click to browse
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text,.docx,text/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </div>
          
          <div className={styles.orDivider}>
            <span>OR</span>
          </div>
          
          <textarea
            className={styles.pasteTextarea}
            value={uploadedText}
            onChange={e => setUploadedText(e.target.value)}
            placeholder="Paste your study concept text here..."
            rows={10}
          />
          {parseError && <p className={styles.errorText}>{parseError}</p>}
        </div>
      ) : (
        <div className={styles.manualSection}>
          <p className={styles.hint}>You'll enter the study name and cohort criteria on the following steps.</p>
        </div>
      )}
    </div>
  );

  // Step 1: study name + description
  const renderStep1 = () => (
    <div className={styles.stepBody}>
      <h3 className={styles.stepTitle}>Study name</h3>
      <input
        className={styles.nameInput}
        value={studyName}
        onChange={e => setStudyName(e.target.value)}
        placeholder="e.g. SGLT2i vs GLP-1 Cardiovascular Outcomes Study"
        autoFocus
        onKeyDown={e => e.key === 'Enter' && canAdvance() && handleNext()}
      />
      <h3 className={`${styles.stepTitle} ${styles.stepTitleSecondary}`}>Description (optional)</h3>
      <textarea
        className={styles.descriptionTextarea}
        value={rawDescription}
        onChange={e => setRawDescription(e.target.value)}
        placeholder="Describe your study objectives, patient population, and any known inclusion/exclusion criteria…"
        rows={6}
      />
    </div>
  );

  // Step 2: cohorts
  const renderStep2 = () => (
    <div className={styles.stepBody}>
      <h3 className={styles.stepTitle}>Define your study cohorts.</h3>
      <p className={styles.hint}>
        Add each patient group. Every cohort requires an <strong>entry criterion</strong> — the
        clinical event that defines a patient's index date (e.g. first prescription, first diagnosis).
      </p>

      <div className={styles.cohortsList}>
        {cohorts.map((cohort, ci) => (
          <div key={ci} className={styles.cohortCard}>
            {/* Identity zone */}
            <div className={styles.cohortCardHeader}>
              <div className={styles.cohortIdentity}>
                <input
                  className={styles.cohortNameInput}
                  value={cohort.name}
                  onChange={e => updateCohort(ci, 'name', e.target.value)}
                  placeholder={`Cohort ${ci + 1} name`}
                />
                <input
                  className={styles.cohortDescInput}
                  value={cohort.description}
                  onChange={e => updateCohort(ci, 'description', e.target.value)}
                  placeholder="Brief description of this patient group"
                />
              </div>
              {cohorts.length > 1 && (
                <button className={styles.removeCohortBtn} onClick={() => removeCohort(ci)}>
                  ✕
                </button>
              )}
            </div>

            {/* Criteria zone */}
            <div className={styles.cohortCriteria}>
              <div className={styles.entryRow}>
                <p className={styles.entryLabel}>
                  Entry criterion (index date) <span className={styles.required}>*</span>
                </p>
                <input
                  className={styles.entryInput}
                  value={cohort.entry_criterion}
                  onChange={e => updateCohort(ci, 'entry_criterion', e.target.value)}
                  placeholder="e.g. First prescription of an SGLT2 inhibitor"
                />
              </div>

              <div className={styles.criteriaRow}>
                <div className={styles.criteriaCol}>
                  <p className={styles.criteriaLabel}>Inclusion criteria</p>
                  {cohort.inclusions.map((inc, ii) => (
                    <div key={ii} className={styles.criteriaItem}>
                      <input
                        className={styles.criteriaInput}
                        value={inc}
                        onChange={e => updateListItem(ci, 'inclusions', ii, e.target.value)}
                        placeholder="e.g. Age ≥ 18 years"
                      />
                      <button
                        className={styles.criteriaRemoveBtn}
                        onClick={() => removeListItem(ci, 'inclusions', ii)}
                      >
                        −
                      </button>
                    </div>
                  ))}
                  <button className={styles.criteriaAddBtn} onClick={() => addListItem(ci, 'inclusions')}>
                    + Add criterion
                  </button>
                </div>

                <div className={styles.criteriaCol}>
                  <p className={styles.criteriaLabel}>Exclusion criteria</p>
                  {cohort.exclusions.map((exc, ei) => (
                    <div key={ei} className={styles.criteriaItem}>
                      <input
                        className={styles.criteriaInput}
                        value={exc}
                        onChange={e => updateListItem(ci, 'exclusions', ei, e.target.value)}
                        placeholder="e.g. Prior history of cancer"
                      />
                      <button
                        className={styles.criteriaRemoveBtn}
                        onClick={() => removeListItem(ci, 'exclusions', ei)}
                      >
                        −
                      </button>
                    </div>
                  ))}
                  <button className={styles.criteriaAddBtn} onClick={() => addListItem(ci, 'exclusions')}>
                    + Add criterion
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className={styles.addCohortBtn} onClick={addCohort}>
        + Add another cohort
      </button>
    </div>
  );

  // Step 3: codelists
  const handleCodelistFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(addCodelistFile);
  };

  const addCodelistFile = async (file: File) => {
    const text = await file.text();
    setCodelistFiles(prev => {
      if (prev.some(f => f.filename === file.name)) return prev;
      return [...prev, { filename: file.name, rawCsv: text }];
    });
  };

  const removeCodelistFile = (filename: string) => {
    setCodelistFiles(prev => prev.filter(f => f.filename !== filename));
  };

  const renderStep3 = () => (
    <div className={styles.stepBody}>
      <h3 className={styles.stepTitle}>Codelists</h3>
      <p className={styles.hint}>
        Upload codelist CSV files now (optional) — the AI will reference them when prefilling.
        You can always upload more after the study is created.
      </p>

      <div
        className={styles.codelistDropzone}
        onDrop={handleCodelistFileDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => codelistInputRef.current?.click()}
      >
        <span className={styles.dropzonePrompt}>Drop CSV files here, or click to browse</span>
        <input
          ref={codelistInputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          style={{ display: 'none' }}
          onChange={e => Array.from(e.target.files || []).forEach(addCodelistFile)}
        />
      </div>

      {codelistFiles.length > 0 && (
        <ul className={styles.codelistFileList}>
          {codelistFiles.map(f => (
            <li key={f.filename} className={styles.codelistFileItem}>
              <span className={styles.codelistFileName}>📄 {f.filename}</span>
              <button className={styles.codelistRemoveBtn} onClick={() => removeCodelistFile(f.filename)}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <h3 className={`${styles.stepTitle} ${styles.stepTitleSecondary}`}>Additional codelist notes (optional)</h3>
      <p className={styles.hint}>Describe any codelists you'll need but don't have files for yet.</p>
      <textarea
        className={styles.descriptionTextarea}
        value={codelistNotes}
        onChange={e => setCodelistNotes(e.target.value)}
        placeholder={`e.g.
- ICD-10 codes for Type 2 Diabetes (E11)
- Drug codes for SGLT2 inhibitors (empagliflozin, dapagliflozin, canagliflozin)
- ICD-10 codes for heart failure (I50)`}
        rows={5}
      />
    </div>
  );

  // Step 4: database configuration
  const renderStep4 = () => {
    // Get available schemas for selected database
    const getAvailableSchemas = (db: string): string[] => {
      const dbConfig = databasesData.find((d: any) => d.database === db);
      return dbConfig?.schemas || [];
    };

    const availableSchemas = getAvailableSchemas(selectedDatabase);
    const validCohorts = cohorts.filter(c => c.name.trim());

    // Helper to get cohort database/schema or fallback to study-wide
    const getCohortDatabase = (cohortName: string) => {
      return cohortDatabases[cohortName]?.database || selectedDatabase;
    };

    const getCohortSchema = (cohortName: string) => {
      return cohortDatabases[cohortName]?.schema || selectedSchema;
    };

    // Helper to update cohort database config
    const updateCohortDatabase = (cohortName: string, database: string, schema: string) => {
      setCohortDatabases(prev => ({
        ...prev,
        [cohortName]: { database, schema }
      }));
    };

    return (
      <div className={styles.stepBody}>
        <h3 className={styles.stepTitle}>Database Configuration</h3>
        <p className={styles.hint}>
          Select the database and schema you'll use for this study. You can configure per-cohort databases or use a single study-wide configuration.
        </p>

        <div className={styles.databaseSection}>
          <label className={styles.inputLabel}>Database (study-wide default)</label>
          <select
            className={styles.selectInput}
            value={selectedDatabase}
            onChange={e => {
              setSelectedDatabase(e.target.value);
              setSelectedSchema(''); // Reset schema when database changes
            }}
          >
            <option value="">Select a database...</option>
            {databasesData.map((db: any) => (
              <option key={db.database} value={db.database}>
                {db.database}
                {db.n_patients ? ` (${db.n_patients.toLocaleString()} patients)` : ''}
              </option>
            ))}
          </select>

          {selectedDatabase && availableSchemas.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label className={styles.inputLabel}>Schema (study-wide default)</label>
              <select
                className={styles.selectInput}
                value={selectedSchema}
                onChange={e => setSelectedSchema(e.target.value)}
              >
                <option value="">Select a schema...</option>
                {availableSchemas.map((schema: string) => (
                  <option key={schema} value={schema}>{schema}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className={styles.databaseOption}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={perCohortDatabase}
              onChange={e => setPerCohortDatabase(e.target.checked)}
            />
            <span>Allow per-cohort database configuration</span>
          </label>
          <p className={styles.optionHint}>
            {perCohortDatabase 
              ? 'Configure database and schema for each cohort below. Defaults to study-wide configuration.'
              : 'All cohorts will use the same study-wide database and schema.'}
          </p>
        </div>

        {perCohortDatabase && validCohorts.length > 0 && (
          <div className={styles.cohortDatabaseList}>
            <h4 className={styles.cohortDatabaseTitle}>Per-Cohort Configuration</h4>
            {validCohorts.map((cohort, idx) => {
              const cohortDb = getCohortDatabase(cohort.name);
              const cohortSchema = getCohortSchema(cohort.name);
              const cohortSchemas = getAvailableSchemas(cohortDb);

              return (
                <div key={idx} className={styles.cohortDatabaseCard}>
                  <div className={styles.cohortDatabaseHeader}>
                    <strong>{cohort.name}</strong>
                  </div>

                  <div className={styles.cohortDatabaseFields}>
                    <div>
                      <label className={styles.inputLabel}>Database</label>
                      <select
                        className={styles.selectInput}
                        value={cohortDb}
                        onChange={e => {
                          updateCohortDatabase(cohort.name, e.target.value, '');
                        }}
                      >
                        <option value="">Use study-wide default</option>
                        {databasesData.map((db: any) => (
                          <option key={db.database} value={db.database}>
                            {db.database}
                          </option>
                        ))}
                      </select>
                    </div>

                    {cohortDb && cohortSchemas.length > 0 && (
                      <div>
                        <label className={styles.inputLabel}>Schema</label>
                        <select
                          className={styles.selectInput}
                          value={cohortSchema}
                          onChange={e => {
                            updateCohortDatabase(cohort.name, cohortDb, e.target.value);
                          }}
                        >
                          <option value="">Use study-wide default</option>
                          {cohortSchemas.map((schema: string) => (
                            <option key={schema} value={schema}>{schema}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Step 5: summary
  const renderStep5 = () => {
    const validCohorts = cohorts.filter(c => c.name.trim());
    return (
      <div className={styles.stepBody}>
        <h3 className={`${styles.stepTitle} ${styles.stepTitleCentered}`}>Ready to create your study</h3>
        <p className={`${styles.hint} ${styles.hintCentered}`}>
          You've configured your study — now choose how to proceed.
        </p>

        <div className={styles.summaryCompact}>
          <div className={styles.summaryCompactRow}>
            <span className={styles.summaryCompactIcon}>📋</span>
            <div>
              <div className={styles.summaryCompactLabel}>Study</div>
              <div className={styles.summaryCompactValue}>{studyName || 'Unnamed Study'}</div>
            </div>
          </div>

          <div className={styles.summaryCompactRow}>
            <span className={styles.summaryCompactIcon}>👥</span>
            <div>
              <div className={styles.summaryCompactLabel}>Cohorts</div>
              <div className={styles.summaryCompactValue}>
                {validCohorts.length === 0 ? 'None defined' : validCohorts.map(c => c.name).join(', ')}
              </div>
            </div>
          </div>

          {codelistFiles.length > 0 && (
            <div className={styles.summaryCompactRow}>
              <span className={styles.summaryCompactIcon}>📄</span>
              <div>
                <div className={styles.summaryCompactLabel}>Codelists</div>
                <div className={styles.summaryCompactValue}>
                  {codelistFiles.length} file{codelistFiles.length !== 1 ? 's' : ''} uploaded
                </div>
              </div>
            </div>
          )}

          {selectedDatabase && (
            <div className={styles.summaryCompactRow}>
              <span className={styles.summaryCompactIcon}>🗄️</span>
              <div>
                <div className={styles.summaryCompactLabel}>Database</div>
                <div className={styles.summaryCompactValue}>
                  {selectedDatabase}{selectedSchema ? ` / ${selectedSchema}` : ''}
                </div>
              </div>
            </div>
          )}
        </div>

        <p className={`${styles.actionPrompt} ${styles.actionPromptCentered}`}>What would you like to do next?</p>

        <div className={styles.actionButtons}>
          <button
            className={`${styles.aiBtn} ${selectedAction === 'ai' ? styles.actionBtnSelected : ''}`}
            onClick={() => setSelectedAction('ai')}
          >
            <span className={styles.actionIcon}>✦</span>
            <div>
              <p className={styles.actionTitle}>Prefill with AI</p>
              <p className={styles.actionDesc}>
                AI will use your intake to populate phenotypes, codelists, and criteria.
              </p>
            </div>
          </button>

          <button
            className={`${styles.shellBtn} ${selectedAction === 'shell' ? styles.actionBtnSelected : ''}`}
            onClick={() => setSelectedAction('shell')}
          >
            <span className={styles.actionIcon}>🗂</span>
            <div>
              <p className={styles.actionTitle}>Create Study Shell</p>
              <p className={styles.actionDesc}>
                Create an empty study with cohort placeholders based on your intake.
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isFinalStep = step === STEP_TITLES.length - 1;

  return (
    <Modal
      isVisible={isVisible}
      onClose={handleClose}
      contentClassName={styles.wizardContent}
      maxWidth="900px"
    >
      <div className={styles.stepMarkerWrap}>
        <StepMarker
          stepTitles={STEP_TITLES}
          activeStep={step}
          onStepClick={idx => { if (idx < step) setStep(idx); }}
        />
      </div>

      <div className={styles.stepContent}>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>

      <div className={styles.navButtons}>
        <button className={styles.navBtn} onClick={handleClose}>
          Cancel
        </button>
        {onSkip && !isFinalStep && (
          <button className={styles.navBtnSkip} onClick={onSkip} title="Skip intake and create a blank study">
            Skip onboarding
          </button>
        )}
        <button
          className={styles.navBtn}
          onClick={handleBack}
          disabled={step === 0}
        >
          Back
        </button>
        <button
          className={`${styles.navBtn} ${styles.navBtnPrimary}`}
          onClick={handleNext}
          disabled={!canAdvance() || isParsing || isSubmitting}
        >
          {isParsing ? 'Parsing…' : isSubmitting ? 'Creating…' : isFinalStep ? 'Finish' : 'Next'}
        </button>
      </div>
    </Modal>
  );
};
