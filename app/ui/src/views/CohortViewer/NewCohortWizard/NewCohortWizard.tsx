import { FC, useState, useEffect } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { StepMarker } from '../../../components/StepMarker/StepMarker';
import { EditableTextField } from '../../../components/EditableTextField/EditableTextField';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { CohortTextArea } from '../../SlideoverPanels/InfoPanel/CohortTextArea/CohortTextArea';
import { DatabasePanel } from '../../SlideoverPanels/DatabasePanel/DatabasePanel';
import { CodelistsViewer } from '../../SlideoverPanels/CodelistsViewer/CodelistsViewer';
import { ConstantsPanel } from '../../SlideoverPanels/ConstantsPanel/ConstantsPanel';

import styles from './NewCohortWizard.module.css';

interface NewCohortWizardProps {
  isVisible: boolean;
  onClose: () => void;
  data: any; // TODO: Make this more specific
}

export const NewCohortWizard: FC<NewCohortWizardProps> = ({ isVisible, onClose, data: _data }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [cohortName, setCohortName] = useState('');
  const [dataService] = useState(() => CohortDataService.getInstance());

  const stepTitles = ['Cohort name', 'Description', 'Database', 'Codelists', 'Constants'];

  useEffect(() => {
    // Initialize the data service with the new cohort data when wizard becomes visible
    const initializeData = async () => {
      if (isVisible && _data) {
        await dataService.loadCohortData(_data);
        setCohortName(dataService.cohort_name);
      }
    };
    initializeData();
  }, [isVisible, _data, dataService]);

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
              dataService.cohort_name = newValue;
            }}
            onSaveChanges={async () => {
              await dataService.saveChangesToCohort();
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
          Enter a text description of your cohort for documentation purposes.
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

  return (
    <Modal
      isVisible={isVisible}
      onClose={onClose}
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
        {currentStep === 1 && renderDescriptionStep()}
        {currentStep === 2 && renderDatabaseStep()}
        {currentStep === 3 && renderCodelistsStep()}
        {currentStep === 4 && renderConstantsStep()}
      </div>

      <div className={styles.navigationButtons}>
        <button
          className={styles.button}
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          Previous
        </button>

        <button
          className={styles.button}
          onClick={() => setCurrentStep(Math.min(stepTitles.length - 1, currentStep + 1))}
          disabled={currentStep === stepTitles.length - 1}
        >
          {currentStep === stepTitles.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </Modal>
  );
};
