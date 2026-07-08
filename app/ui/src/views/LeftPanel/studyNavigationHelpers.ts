/**
 * Centralized navigation helpers for study and cohort creation.
 * All "Create Study" and "Create Cohort" buttons should use these functions
 * to ensure consistent behavior across the application.
 */

import { NavigateFunction } from 'react-router-dom';
import { CohortsDataService } from './CohortsDataService';
import type { StudyIntake } from '@/views/StudyViewer/NewStudyWizard/StudyIntakeWizard';
import { createID } from '@/types/createID';

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
      console.warn('⚠️ Study not found in loaded list:', studyId, 'proceeding with ID');
    }
    
    // Create the new cohort - pass study object if found, otherwise studyId string
    const newCohortData = await cohortsDataService.createNewCohort(study || studyId);
    
    if (newCohortData) {
      console.log('✅ Cohort created, navigating to:', newCohortData.id);
      // Add onboarding=true query parameter to trigger the wizard
      navigate(`/studies/${studyId}`);
    }
  } catch (error) {
    console.error('❌ Failed to create cohort:', error);
    throw error;
  }
}

/**
 * Creates a new cohort for a study without navigation (for use in StudyViewer panel).
 * Returns the cohort data for display in a right panel wizard.
 * 
 * @param studyId - The ID of the study to create the cohort in
 * @returns The newly created cohort data
 */
export async function createCohort(studyId: string): Promise<any> {
  console.log('🆕 Creating new cohort for study:', studyId);
  const cohortsDataService = CohortsDataService.getInstance();
  
  try {
    // Get the study data
    const userStudies = await cohortsDataService.getUserStudies();
    const publicStudies = await cohortsDataService.getPublicStudies();
    const allStudies = [...userStudies, ...publicStudies];
    const study = allStudies.find(s => s.id === studyId);
    
    if (!study) {
      console.warn('⚠️ Study not found in loaded list:', studyId, 'proceeding with ID');
    }
    
    // Create the new cohort - pass study object if found, otherwise studyId string
    const newCohortData = await cohortsDataService.createNewCohort(study || studyId);
    
    if (newCohortData) {
      console.log('✅ Cohort created:', newCohortData.id);
      return newCohortData;
    }
  } catch (error) {
    console.error('❌ Failed to create cohort:', error);
    throw error;
  }
}

/**
 * Creates a study (and its cohorts) from the intake wizard data, then navigates to it.
 * If action is 'ai', navigates with ?prefill=true so the study viewer can kick off AI.
 */
export async function createStudyFromIntake(
  intake: StudyIntake,
  action: 'shell' | 'ai',
  navigate: NavigateFunction,
): Promise<void> {
  const cohortsDataService = CohortsDataService.getInstance();

  // 1. Create the study
  const newStudy = await cohortsDataService.createNewStudy();
  if (!newStudy) throw new Error('Failed to create study');

  // 2. Patch name / description / type (the data service creates with a temp name)
  const { updateStudy } = await import('@/api/text_to_cohort/route');
  await updateStudy(newStudy.id, {
    name: intake.studyName || newStudy.name,
    description: intake.rawDescription,
    study_type: intake.studyType,
  });
  newStudy.name = intake.studyName || newStudy.name;

  // 3. Create cohorts with placeholder phenotypes from intake
  const validCohorts = intake.cohorts.filter(c => c.name.trim());
  const createdCohortIds: string[] = [];

  // Helper: build a minimal placeholder CodelistPhenotype with the new phenotypes-array format
  const makePlaceholder = (text: string, type: 'entry' | 'inclusion' | 'exclusion') => ({
    id: createID(),
    type,
    class_name: 'CodelistPhenotype',
    name: text.toUpperCase(),
    description: text,
    output_display_type: 'boolean',
    domain: 'CONDITION_OCCURRENCE_SOURCE',
    date_range: null,
    relative_time_range: null,
    return_date: 'first',
    return_value: null,
    categorical_filter: null,
    codelist: {
      class_name: 'Codelist',
      codelist: {},
      name: null,
      use_code_type: false,
      remove_punctuation: null,
      fuzzy_match: null,
      rename_code_type: null,
      code_type_info: null,
    },
  });

  for (const cohortIntake of validCohorts) {
    const cohortData = await cohortsDataService.createNewCohort(newStudy);
    if (cohortData) {
      const { updateCohort } = await import('@/api/text_to_cohort/route');

      const entryPlaceholder = cohortIntake.entry_criterion?.trim()
        ? [makePlaceholder(cohortIntake.entry_criterion, 'entry')]
        : [];

      const phenotypes = [
        ...entryPlaceholder,
        ...cohortIntake.inclusions.filter(s => s.trim()).map(s => makePlaceholder(s, 'inclusion')),
        ...cohortIntake.exclusions.filter(s => s.trim()).map(s => makePlaceholder(s, 'exclusion')),
      ];

      const cohortPayload = {
        ...cohortData.cohort_data,
        name: cohortIntake.name,
        description: cohortIntake.description,
        phenotypes,
      };
      await updateCohort(cohortData.study_id, cohortData.id, cohortPayload);
      createdCohortIds.push(cohortData.id);
    }
  }

  // 4. Upload any codelist files collected during intake to all created cohorts
  //    (if no cohorts, create a default one to hold the codelists)
  if (intake.codelistFiles && intake.codelistFiles.length > 0) {
    try {
      const { saveCodelist } = await import('@/api/codelists/route');
      const { createID } = await import('@/types/createID');

      for (const { filename, rawCsv } of intake.codelistFiles) {
        try {
            // Normalize line endings, split into non-empty lines
            const lines = rawCsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
            if (lines.length < 1) continue;

            // Simple CSV line parser (handles quoted fields)
            const parseCSVLine = (line: string): string[] => {
              const result: string[] = [];
              let inQuotes = false;
              let cur = '';
              for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') { inQuotes = !inQuotes; }
                else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
                else { cur += ch; }
              }
              result.push(cur.trim());
              return result;
            };

            const headers = parseCSVLine(lines[0]);
            const data: Record<string, string[]> = {};
            headers.forEach(h => { data[h] = []; });
            for (let i = 1; i < lines.length; i++) {
              const vals = parseCSVLine(lines[i]);
              headers.forEach((h, hi) => data[h].push(vals[hi] ?? ''));
            }

            const filePayload = {
              id: createID(),
              filename,
              code_column: headers.includes('code') ? 'code' : headers[0],
              code_type_column: headers.includes('code_type') ? 'code_type' : (headers[1] ?? headers[0]),
              codelist_column: headers.includes('codelist') ? 'codelist' : (headers[2] ?? headers[0]),
              contents: { headers, data },
            };
            await saveCodelist('', filePayload, newStudy.id);
            console.log(`✅ Uploaded codelist ${filename} to study ${newStudy.id}`);
          } catch (fileErr) {
            console.error(`❌ Failed to upload codelist ${filename}:`, fileErr);
          }
      }
    } catch (uploadErr) {
      console.error('❌ Codelist upload failed:', uploadErr);
    }
  }

  cohortsDataService.invalidateCache();

  // 4. For AI prefill, store the intake in sessionStorage so the study view can retrieve it
  if (action === 'ai') {
    sessionStorage.setItem(`intake_${newStudy.id}`, JSON.stringify(intake));
  }

  // 5. Navigate – add ?prefill=true for AI case so the study view can act on it
  const query = action === 'ai' ? '?prefill=true' : '';
  navigate(`/studies/${newStudy.id}${query}`);
}
