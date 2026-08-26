import { api } from '../httpClient';

export interface StudyIssue {
  message: string;
  severity: 'error' | 'warning';
  cohort_id?: string;
  cohort_name?: string;
  phenotype_id?: string;
  phenotype_name?: string;
}

export interface StudyValidationResponse {
  valid: boolean;
  errors: StudyIssue[];
  warnings: StudyIssue[];
}

/**
 * Validate a study and get all issues that prevent execution
 */
export const getStudyIssues = async (studyId: string): Promise<StudyValidationResponse> => {
  try {
    const response = await api.get(`/study/${studyId}/issues`);
    return response.data;
  } catch (error) {
    console.error('Error fetching study issues:', error);
    throw error;
  }
};
