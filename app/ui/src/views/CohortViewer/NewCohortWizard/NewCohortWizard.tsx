import { FC, useState } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { StepMarker } from '../../../components/StepMarker/StepMarker';
import { EditableTextField } from '../../../components/EditableTextField/EditableTextField';
import { CohortDataService } from '../CohortDataService/CohortDataService';
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
  
  const stepTitles = ['Cohort name', 'Description', 'Database', 'Codelists'];

  const handleStepClick = (stepIndex: number) => {
    console.log(`Step clicked: ${stepIndex} (${stepTitles[stepIndex]})`);
    setCurrentStep(stepIndex);
  };

  const renderNameStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>Cohort Name</h3>
        <p className={styles.description}>
          Please enter a name for your new cohort.
        </p>
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
  }

  const renderDescriptionStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>Description</h3>
        <p className={styles.description}>
          Please enter a description for your new cohort.
        </p>
      </div>
    );
  }

  const renderDatabaseStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>Database</h3>
        <p className={styles.description}>
          Please select a database for your new cohort.
        </p>
      </div>
    );
  }

  const renderCodelistsStep = () => {
    return (
      <div>
        <h3 className={styles.stepTitle}>Codelists</h3>
        <p className={styles.description}>
          Please select codelists for your new cohort.
        </p>
      </div>
    );
  }

  return (
    <Modal 
      isVisible={isVisible} 
      onClose={onClose}
      contentClassName={styles.wizardContent}
      maxWidth="800px"
    >
        <div className = {styles.stepMarker}>
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
