import { FC, useState, useEffect } from 'react';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { StepMarker } from '../../../components/StepMarker/StepMarker';
import { EditableTextField } from '../../../components/EditableTextField/EditableTextField';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { CohortTextArea } from '../InfoPanel/CohortTextArea/CohortTextArea';
import { DatabasePanel } from '../DatabasePanel/DatabasePanel';
import { CodelistsViewer } from '../CodelistsViewer/CodelistsViewer';
import { ConstantsPanel } from '../ConstantsPanel/ConstantsPanel';
import styles from './NewCohortWizardPanel.module.css';

interface NewCohortWizardPanelProps {
  data: any;
}

export const NewCohortWizardPanel: FC<NewCohortWizardPanelProps> = ({ data: _data }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [cohortName, setCohortName] = useState('');
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [isInitialized, setIsInitialized] = useState(false);

  const stepTitles = ['Cohort name', 'Description', 'Database', 'Codelists', 'Constants', 'Finish'];

  useEffect(() => {
    // Initialize the data service with the new cohort data
    const initializeData = async () => {
      if (_data && !isInitialized) {
        // Load the full cohort object into data service
        await dataService.loadCohortData(_data);
        // Set the cohort name from the data service (the default ID-based name)
        const initialName = dataService.cohort_name;
        setCohortName(initialName);
        setIsInitialized(true);
      }
    };
    initializeData();
  }, [_data, dataService, isInitialized]);

  useEffect(() => {
    // Focus the appropriate input when step changes
    const focusInput = () => {
      if (currentStep === 0) {
        // Focus the editable text field input
        const nameInput = document.querySelector(`.${styles.cohortNameInput} input`) as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
        }
      }
    };
    focusInput();
  }, [currentStep]);

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
    console.log('💾 NewCohortWizard: Saving cohort updates to backend on finish');
    try {
      // Update the cohort name in the data service
      dataService.cohort_name = cohortName;
      
      // Save to backend
      await dataService.saveChangesToCohort();
      console.log('✅ NewCohortWizard: Cohort saved successfully');
      
      // Force update of left panel by clearing cache and notifying
      const { CohortsDataService } = await import('../../LeftPanel/CohortsDataService');
      const cohortsDataService = CohortsDataService.getInstance();
      const studyId = dataService.cohort_data?.study_id;
      if (studyId) {
        console.log('🔄 NewCohortWizard: Clearing cohort cache for study', studyId);
        cohortsDataService.clearStudyCohortsCache(studyId);
        cohortsDataService['notifyListeners'](); // Force notification
      }
    } catch (error) {
      console.error('❌ NewCohortWizard: Failed to save cohort:', error);
    }
  };

  const handleSkip = async () => {
    // Save current changes and close, leaving onboarding incomplete
    try {
      // Update the cohort name in the data service
      dataService.cohort_name = cohortName;
      
      // Save to backend
      await dataService.saveChangesToCohort();
      
      // Force update of left panel by clearing cache and notifying
      const { CohortsDataService } = await import('../../LeftPanel/CohortsDataService');
      const cohortsDataService = CohortsDataService.getInstance();
      const studyId = dataService.cohort_data?.study_id;
      if (studyId) {
        cohortsDataService.clearStudyCohortsCache(studyId);
        cohortsDataService['notifyListeners'](); // Force notification
      }
    } catch (error) {
      console.error('Failed to save cohort on skip:', error);
    }
  };

  const renderNameStep = () => {
    return (
      <div onKeyDown={handleKeyDown}>
        <h3 className={styles.stepTitle}>Enter a unique name for your new cohort.</h3>
        <div className={styles.cohortNameContainer}>
          <EditableTextField
            value={cohortName}
            placeholder="Name your cohort..."
            className={styles.cohortNameInput}
            onChange={newValue => {
              setCohortName(newValue);
            }}
            onSaveChanges={async () => {
              // Don't save to backend during wizard, just update local state
            }}
          />
        </div>
      </div>
    );
  };

  const renderDescriptionStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>
          Enter a text description of your cohort. AI can use this to help create your cohort!
        </h3>
        <CohortTextArea />
      </div>
    );
  };

  const renderDatabaseStep = () => {
    return <DatabasePanel showTitle={false} />;
  };

  const renderCodelistsStep = () => {
    return <CodelistsViewer showTitle={false} />;
  };

  const renderConstantsStep = () => {
    return <ConstantsPanel showTitle={false} />;
  };

  const renderCompletionStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>You're now ready to define your cohort!</h3>
        <div className={styles.cohortNameContainer}>
          <ul>
            <li>Click finish to enter the Cohort Editor. Add new phenotypes to define your entry, inclusion and exclusion criteria. Then add baseline characteristics and outcomes of interest.</li>
            <li>You can edit all your added phenotypes directly in the Cohort Editor table.</li>
            <li>Edit a single phenotype by clicking on the edit button on the phenotype name.</li>
            <li>You can access all the parameters you defined here in the action toolbar.</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <SlideoverPanel
      title="New Cohort Wizard"
      info="Complete these steps to set up your new cohort."
      showTitle={true}
    >
      <div className={styles.wizardContent}>
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
          {currentStep === 1 && renderDescriptionStep()}
          {currentStep === 2 && renderDatabaseStep()}
          {currentStep === 3 && renderCodelistsStep()}
          {currentStep === 4 && renderConstantsStep()}
          {currentStep === 5 && renderCompletionStep()}
        </div>
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
              // On finish, save to backend
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
    </SlideoverPanel>
  );
};
