import { FC } from 'react';
import styles from './StepMarker.module.css';

interface StepMarkerProps {
  stepTitles: string[];
  activeStep: number; // 0-based index
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export const StepMarker: FC<StepMarkerProps> = ({ 
  stepTitles, 
  activeStep, 
  onStepClick,
  className = ''
}) => {
  const handleStepClick = (stepIndex: number) => {
    // Only allow clicking on previous steps or current step, not future steps
    if (stepIndex <= activeStep && onStepClick) {
      onStepClick(stepIndex);
    }
  };

  const getStepStatus = (stepIndex: number): 'completed' | 'active' | 'inactive' => {
    if (stepIndex < activeStep) return 'completed';
    if (stepIndex === activeStep) return 'active';
    return 'inactive';
  };

  const isClickable = (stepIndex: number): boolean => {
    return stepIndex <= activeStep;
  };

  return (
    <div className={`${styles.stepMarker} ${className}`}>
      {stepTitles.map((title, index) => {
        const status = getStepStatus(index);
        const clickable = isClickable(index);
        const connectorCompleted = index < activeStep;
        
        return (
          <div 
            key={index} 
            className={`${styles.stepContainer} ${connectorCompleted ? styles.connectorCompleted : ''}`}
          >
            <div 
              className={`${styles.step} ${styles[status]} ${clickable ? styles.clickable : ''}`}
              onClick={() => handleStepClick(index)}
            >
              <div className={styles.circle}>
                {status === 'completed' ? (
                  <span className={styles.checkmark}>✓</span>
                ) : (
                  <span className={styles.number}>{index + 1}</span>
                )}
              </div>
              <div className={styles.label}>{title}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
