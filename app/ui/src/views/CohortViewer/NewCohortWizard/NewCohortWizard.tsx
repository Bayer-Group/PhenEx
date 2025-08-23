import { FC, useState } from 'react';
import { Modal } from '../../../components/Modal/Modal';
import { StepMarker } from '../../../components/StepMarker/StepMarker';
import styles from './NewCohortWizard.module.css';

interface NewCohortWizardProps {
  isVisible: boolean;
  onClose: () => void;
  data: any; // TODO: Make this more specific
}

export const NewCohortWizard: FC<NewCohortWizardProps> = ({ isVisible, onClose, data: _data }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const stepTitles = ['Cohort name', 'Description', 'Database', 'Codelists'];

  const handleStepClick = (stepIndex: number) => {
    console.log(`Step clicked: ${stepIndex} (${stepTitles[stepIndex]})`);
    setCurrentStep(stepIndex);
  };

  return (
    <Modal 
      isVisible={isVisible} 
      onClose={onClose}
      contentClassName={styles.wizardContent}
      maxWidth="800px"
    >
      <h2 className={styles.title}>New Cohort Wizard</h2>
      
      <StepMarker 
        stepTitles={stepTitles}
        activeStep={currentStep}
        onStepClick={handleStepClick}
        className={styles.stepMarker}
      />
      
      <div className={styles.stepContent}>
        <h3 className={styles.stepTitle}>Step {currentStep + 1}: {stepTitles[currentStep]}</h3>
        <p className={styles.description}>
          Content for {stepTitles[currentStep]} step coming soon...
        </p>
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
