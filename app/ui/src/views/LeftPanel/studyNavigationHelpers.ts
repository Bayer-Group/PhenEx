/**
 * Centralized navigation helpers for study and cohort creation.
 * All "Create Study" and "Create Cohort" buttons should use these functions
 * to ensure consistent behavior across the application.
 */

import { NavigateFunction } from 'react-router-dom';
import { CohortsDataService } from './CohortsDataService';

/**
 * Creates a new study and navigates to it.
 * This is the single source of truth for study creation behavior.
 * 
 * Flow:
 * 1. Create the study (optimistically updates UI)
 * 2. Navigate to /studies/{studyId}
 */
export async function createAndNavigateToNewStudy(navigate: NavigateFunction): Promise<void> {
  console.log('🆕 Creating new study...');
  const cohortsDataService = CohortsDataService.getInstance();
  
  try {
    const newStudyData = await cohortsDataService.createNewStudy();
    
    if (newStudyData) {
      console.log('✅ Study created, navigating to:', newStudyData.id);
      navigate(`/studies/${newStudyData.id}`);
    }
  } catch (error) {
    console.error('❌ Failed to create study:', error);
    throw error;
  }
}

/**
 * Creates a new cohort for a study and navigates to it with the onboarding wizard.
 * This is the single source of truth for cohort creation behavior.
 * 
 * Flow:
 * 1. Create the cohort (optimistically updates UI)
 * 2. Navigate to /studies/{studyId}/cohorts/{cohortId}?onboarding=true
 * 3. The URL-based routing will automatically show the onboarding wizard
 * 
 * @param studyId - The ID of the study to create the cohort in
 * @param navigate - The navigate function from useNavigate()
 */
export async function createAndNavigateToNewCohort(
  studyId: string, 
  navigate: NavigateFunction
): Promise<void> {
  console.log('🆕 Creating new cohort for study:', studyId);
  const cohortsDataService = CohortsDataService.getInstance();
  
  try {
    // Get the study data
    const userStudies = await cohortsDataService.getUserStudies();
    const publicStudies = await cohortsDataService.getPublicStudies();
    const allStudies = [...userStudies, ...publicStudies];
    const study = allStudies.find(s => s.id === studyId);
    
    if (!study) {
      console.error('❌ Study not found:', studyId);
      throw new Error(`Study ${studyId} not found`);
    }
    
    // Create the new cohort
    const newCohortData = await cohortsDataService.createNewCohort(study);
    
    if (newCohortData) {
      console.log('✅ Cohort created, navigating to:', newCohortData.id);
      // Add onboarding=true query parameter to trigger the wizard
      navigate(`/studies/${studyId}/cohorts/${newCohortData.id}?onboarding=true`);
    }
  } catch (error) {
    console.error('❌ Failed to create cohort:', error);
    throw error;
  }
}
