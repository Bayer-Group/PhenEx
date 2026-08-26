import { FC, useState, useEffect } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { StepMarker } from '../../../components/StepMarker/StepMarker';
import { EditableTextField } from '../../../components/EditableTextField/EditableTextField';
import { CohortTextArea } from '../../SlideoverPanels/InfoPanel/CohortTextArea/CohortTextArea';
import { CodelistsViewer } from '../../SlideoverPanels/CodelistsViewer/CodelistsViewer';
import { getCodelistsForCohort } from '@/api/codelists/route';
import { getStudy } from '@/api/text_to_cohort/route';

import styles from './NewStudyWizard.module.css';

interface NewStudyWizardProps {
  isVisible: boolean;
  onClose: () => void;
  onUpdate: (updates: { name?: string; description?: string; study_type?: string }) => Promise<void>;
  studyId?: string;
  studyDescription?: string;
}

// Standard observational study types
const STUDY_TYPES = [
  { value: 'cohort', label: 'Cohort Study' },
  { value: 'case_control', label: 'Case-Control Study' },
  { value: 'cross_sectional', label: 'Cross-Sectional Study' },
  { value: 'case_series', label: 'Case Series' },
  { value: 'registry', label: 'Registry Study' },
  { value: 'ecological', label: 'Ecological Study' },
  { value: 'other', label: 'Other' },
];

export const NewStudyWizard: FC<NewStudyWizardProps> = ({ 
  isVisible, 
  onClose, 
  onUpdate,
  studyId,
  studyDescription: initialDescription = ''
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [studyName, setStudyName] = useState('');
  const [studyType, setStudyType] = useState('cohort');
  const [studyDescription, setStudyDescription] = useState(initialDescription);
  const [codelistCount, setCodelistCount] = useState(0);

  const stepTitles = ['Study name', 'Study type', 'Description', 'Codelists', 'Finish'];

  useEffect(() => {
    // Load codelist count when wizard opens
    const loadCodelistCount = async () => {
      if (studyId && isVisible) {
        try {
          const codelists = await getCodelistsForCohort(studyId);
          // Count unique codelists across all files
          const uniqueCodelists = new Set<string>();
          codelists.forEach((file: any) => {
            if (file.codelists && Array.isArray(file.codelists)) {
              file.codelists.forEach((cl: string) => uniqueCodelists.add(cl));
            }
          });
          setCodelistCount(uniqueCodelists.size);
        } catch (error) {
          console.error('Failed to load codelists:', error);
          setCodelistCount(0);
        }
      }
    };

    loadCodelistCount();
  }, [studyId, isVisible]);

  useEffect(() => {
    // Fetch fresh study data when reaching the finish step
    const loadStudyData = async () => {
      if (studyId && currentStep === 4) {
        try {
          const study = await getStudy(studyId);
          if (study.description) {
            console.log('📥 Loaded description from backend:', study.description);
            setStudyDescription(study.description);
          }
        } catch (error) {
          console.error('Failed to load study data:', error);
        }
      }
    };

    loadStudyData();
  }, [studyId, currentStep]);

  useEffect(() => {
    // Focus the appropriate input when step changes
    const focusInput = () => {
      if (currentStep === 0) {
        // Focus the editable text field input
        const nameInput = document.querySelector(`.${styles.studyNameInput} input`) as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
        }
      }
    };

    if (isVisible) {
      focusInput();
    }
  }, [currentStep, isVisible]);

  const handleStepClick = (stepIndex: number) => {
    console.log(`Step clicked: ${stepIndex} (${stepTitles[stepIndex]})`);
    setCurrentStep(stepIndex);
  };

  const handleNextStep = () => {
    if (currentStep < stepTitles.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNextStep();
    }
  };

  const handleFinish = async () => {
    // Save all changes to backend when finishing the wizard
    console.log('💾 NewStudyWizard: Saving study updates to backend on finish');
    try {
      await onUpdate({
        name: studyName,
        description: studyDescription,
        study_type: studyType,
      });
      console.log('✅ NewStudyWizard: Study saved successfully');
      
      // Force update of left panel by clearing cache and notifying
      const { CohortsDataService } = await import('../../LeftPanel/CohortsDataService');
      const cohortsDataService = CohortsDataService.getInstance();
      console.log('🔄 NewStudyWizard: Invalidating cache');
      cohortsDataService.invalidateCache();
      cohortsDataService['notifyListeners'](); // Force notification
    } catch (error) {
      console.error('❌ NewStudyWizard: Failed to save study:', error);
    }
    
    // Close the wizard
    onClose();
  };

  const handleSkip = async () => {
    // Save current changes and close, leaving onboarding incomplete
    try {
      await onUpdate({
        name: studyName,
        description: studyDescription,
        study_type: studyType,
      });
      
      // Force update of left panel by clearing cache and notifying
      const { CohortsDataService } = await import('../../LeftPanel/CohortsDataService');
      const cohortsDataService = CohortsDataService.getInstance();
      cohortsDataService.invalidateCache();
      cohortsDataService['notifyListeners'](); // Force notification
    } catch (error) {
      console.error('Failed to save study on skip:', error);
    }
    
    // Close the wizard
    onClose();
  };

  const renderNameStep = () => {
    return (
      <div onKeyDown={handleKeyDown}>
        <h3 className={styles.stepTitle}>Enter a unique name for your new study.</h3>
        <div className={styles.cohortNameContainer}>
          <EditableTextField
            value={studyName}
            placeholder="Name your study..."
            className={styles.cohortNameInput}
            onChange={newValue => {
              setStudyName(newValue);
            }}
            onSaveChanges={async () => {
              // Don't save to backend during wizard, just update local state
            }}
          />
        </div>
      </div>
    );
  };

  const renderTypeStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>Select the type of observational study.</h3>
        <div className={styles.studyTypeContainer}>
          <select
            value={studyType}
            onChange={(e) => setStudyType(e.target.value)}
            className={styles.studyTypeSelect}
          >
            {STUDY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const renderDescriptionStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>
          Enter a text description of your study.
        </h3>
        <CohortTextArea />
      </div>
    );
  };

  const renderCodelistsStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>Import codelists for your study (optional).</h3>
        <CodelistsViewer showTitle={false} />
      </div>
    );
  };

  const renderCompletionStep = () => {
    // Analyze description for key terms (case-insensitive)
    console.log('🔍 Checking study description:', studyDescription);
    const hasExclusions = /exclusion/i.test(studyDescription);
    const hasInclusions = /inclusion/i.test(studyDescription);
    const hasOutcomes = /outcome/i.test(studyDescription);
    const hasCharacteristics = /characteristic/i.test(studyDescription);
    console.log('✓ Matches:', { hasInclusions, hasExclusions, hasOutcomes, hasCharacteristics });
    
    const studyTypeLabel = STUDY_TYPES.find(t => t.value === studyType)?.label || 'Unknown';

    return (
      <div>
        <h3 className={styles.stepTitle}>Study Summary</h3>
        <div className={styles.summaryContent}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Study Type:</span>
            <span className={styles.summaryValue}>{studyTypeLabel}</span>
          </div>
          
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Codelists Defined:</span>
            <span className={styles.summaryValue}>
              {codelistCount > 0 ? (
                <span className={styles.checkmark}>✓ {codelistCount} codelist{codelistCount !== 1 ? 's' : ''}</span>
              ) : (
                <span className={styles.xmark}>✗ None</span>
              )}
            </span>
          </div>
          
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Inclusion Criteria:</span>
            <span className={styles.summaryValue}>
              {hasInclusions ? <span className={styles.checkmark}>✓</span> : <span className={styles.xmark}>✗</span>}
            </span>
          </div>
          
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Exclusion Criteria:</span>
            <span className={styles.summaryValue}>
              {hasExclusions ? <span className={styles.checkmark}>✓</span> : <span className={styles.xmark}>✗</span>}
            </span>
          </div>
          
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Outcomes Defined:</span>
            <span className={styles.summaryValue}>
              {hasOutcomes ? <span className={styles.checkmark}>✓</span> : <span className={styles.xmark}>✗</span>}
            </span>
          </div>
          
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Patient Characteristics:</span>
            <span className={styles.summaryValue}>
              {hasCharacteristics ? <span className={styles.checkmark}>✓</span> : <span className={styles.xmark}>✗</span>}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isVisible={isVisible}
      onClose={handleSkip}
      contentClassName={styles.wizardContent}
      maxWidth="800px"
    >
      <div className={styles.stepMarker}>
        <StepMarker
          stepTitles={stepTitles}
          activeStep={currentStep}
          onStepClick={handleStepClick}
          className={styles.stepMarker}
        />
      </div>
      <div className={styles.stepContent}>
        {currentStep === 0 && renderNameStep()}
        {currentStep === 1 && renderTypeStep()}
        {currentStep === 2 && renderDescriptionStep()}
        {currentStep === 3 && renderCodelistsStep()}
        {currentStep === 4 && renderCompletionStep()}
      </div>

      <div className={styles.navigationButtons}>
        <button
          className={styles.button}
          onClick={handleSkip}
        >
          Skip
        </button>

        <button
          className={styles.button}
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          Previous
        </button>

        <button
          className={styles.button}
          onClick={() => {
            if (currentStep === stepTitles.length - 1) {
              // On finish, save to backend and close the wizard
              handleFinish();
            } else {
              // On next, advance to next step (don't save)
              setCurrentStep(Math.min(stepTitles.length - 1, currentStep + 1));
            }
          }}
        >
          {currentStep === stepTitles.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </Modal>
  );
};
