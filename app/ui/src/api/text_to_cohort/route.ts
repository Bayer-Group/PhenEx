import { api, authFetch, BACKEND_URL } from '../httpClient';


export const getUserCohort = async (study_id: string, cohort_id: string, provisional: boolean = false) => {
  try {
    const response = await api.get(`/study/${study_id}/cohort/${cohort_id}`, {
      params: { provisional },
    });

    if (response.data.cohort_data && typeof response.data.cohort_data === 'string') {
      response.data.cohort_data = JSON.parse(response.data.cohort_data);
    }

    return response.data;
  } catch (error) {
    console.error('Error in getUserCohort:', error);
    throw error;
  }
};

export const createCohort = async (study_id: string, cohort_id: string, cohort_data: any) => {
  try {
    const response = await api.put(`/study/${study_id}/cohort/${cohort_id}`, cohort_data);
    return response.data;
  } catch (error) {
    console.error('Error in createCohort:', error);
    throw error;
  }
};

export const updateCohort = async (study_id: string, cohort_id: string, cohort_data: any) => {
  try {
    const response = await api.put(`/study/${study_id}/cohort/${cohort_id}`, cohort_data);
    return response.data;
  } catch (error) {
    console.error('Error in updateCohort:', error);
    throw error;
  }
};

export const updateCohortDatabaseConfig = async (study_id: string, cohort_id: string, database: Record<string, any> | null) => {
  try {
    const response = await api.patch(`/study/${study_id}/cohort/${cohort_id}/database`, { database });
    return response.data;
  } catch (error) {
    console.error('Error in updateCohortDatabaseConfig:', error);
    throw error;
  }
};

export const deleteCohort = async (study_id: string, cohort_id: string) => {
  try {
    const response = await api.delete(`/study/${study_id}/cohort/${cohort_id}`);
    return response.data;
  } catch (error) {
    console.error('Error in deleteCohort:', error);
    throw error;
  }
};

export const acceptChanges = async (cohort_id: string) => {
  try {
    const response = await api.get('/copilot/cohort/accept_changes', {
      params: { cohort_id },
    });

    // Parse the cohort_data field if it exists and is a string
    if (response.data.cohort_data && typeof response.data.cohort_data === 'string') {
      response.data.cohort_data = JSON.parse(response.data.cohort_data);
    }

    // Return the full response data which includes is_provisional, version, etc.
    return response.data;
  } catch (error) {
    console.error('Error in acceptChanges:', error);
    throw error;
  }
};

export const rejectChanges = async (cohort_id: string) => {
  try {
    const response = await api.get('/copilot/cohort/reject_changes', {
      params: { cohort_id },
    });

    // Parse the cohort_data field if it exists and is a string
    if (response.data.cohort_data && typeof response.data.cohort_data === 'string') {
      response.data.cohort_data = JSON.parse(response.data.cohort_data);
    }

    // Return the full response data which includes is_provisional, version, etc.
    return response.data;
  } catch (error) {
    console.error('Error in rejectChanges:', error);
    throw error;
  }
};

export const suggestChangesForStudy = async (
  study_id: string,
  user_request: string,
  model: string = 'gpt-4o',
  conversation_history?: Array<{user?: string; system?: string; user_action?: string}>,
  cohort_description?: string,
  active_cohort_id?: string,
): Promise<ReadableStream<Uint8Array>> => {
  const baseURL = (api.defaults.baseURL || '').replace(/\/$/, '');
  const url = new URL(`${baseURL}/copilot/chat`);
  url.searchParams.set('study_id', study_id);
  url.searchParams.set('model', model);
  if (active_cohort_id) url.searchParams.set('active_cohort_id', active_cohort_id);

  const response = await authFetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_request,
      conversation_history: conversation_history || [],
      cohort_description: cohort_description || null,
    }),
  });

  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  if (!response.body) throw new Error('No response body received.');
  return response.body;
};

// ========== STUDY API CALLS ==========

export const getUserStudies = async () => {
  try {
    const response = await api.get('/studies/private');
    return response.data;
  } catch (error) {
    console.error('Error in getUserStudies:', error);
    throw error;
  }
};

export const getPublicStudies = async () => {
  try {
    const response = await api.get('/studies/public');
    return response.data;
  } catch (error) {
    console.error('Error in getPublicStudies:', error);
    throw error;
  }
};

export const getStudy = async (study_id: string) => {
  try {
    const response = await api.get(`/study/${study_id}`);
    return response.data;
  } catch (error) {
    console.error('Error in getStudy:', error);
    throw error;
  }
};

export const getPublicStudy = async (study_id: string) => {
  try {
    const response = await api.get(`/study/${study_id}/public`);
    return response.data;
  } catch (error) {
    console.error('Error in getPublicStudy:', error);
    throw error;
  }
};

export const updateStudy = async (study_id: string, study_data: any) => {
  try {
    console.log('Updating study:', study_data);
    // Ensure study_id is in the body for updates
    const response = await api.put(`/study/${study_id}`, study_data);
    return response.data;
  } catch (error) {
    console.error('Error in updateStudy:', error);
    throw error;
  }
};

export const deleteStudy = async (study_id: string) => {
  try {
    const response = await api.delete(`/study/${study_id}`);
    return response.data;
  } catch (error) {
    console.error('Error in deleteStudy:', error);
    throw error;
  }
};

export const getCohortsForStudy = async (study_id: string) => {
  try {
    const response = await api.get(`/study/${study_id}/cohorts`);
    return response.data;
  } catch (error) {
    console.error('Error in getCohortsForStudy:', error);
    throw error;
  }
};

export const createNewStudy = async (study_data: any) => {
  try {
    console.log('Creating new study:', study_data);
    const response = await api.put('/study/new', study_data);
    return response.data;
  } catch (error) {
    console.error('Error in createNewStudy:', error);
    throw error;
  }
};

export const createDemoStudy = async (): Promise<{ study_id: string }> => {
  try {
    const response = await api.post('/study/demo', {});
    return response.data;
  } catch (error) {
    console.error('Error in createDemoStudy:', error);
    throw error;
  }
};

export const updateStudyDatabaseConfig = async (study_id: string, database: Record<string, any> | null) => {
  try {
    const response = await api.patch(`/study/${study_id}/database`, { database });
    return response.data;
  } catch (error) {
    console.error('Error in updateStudyDatabaseConfig:', error);
    throw error;
  }
};

export const updateStudyDisplayOrder = async (study_id: string, display_order: number) => {
  try {
    const response = await api.patch(`/study/${study_id}/display_order`, null, {
      params: { display_order },
    });
    return response.data;
  } catch (error) {
    console.error('Error in updateStudyDisplayOrder:', error);
    throw error;
  }
};

export const updateCohortDisplayOrder = async (
  study_id: string,
  cohort_id: string,
  display_order: number,
) => {
  try {
    const response = await api.patch(`/study/${study_id}/cohort/${cohort_id}/display_order`, null, {
      params: { display_order },
    });
    return response.data;
  } catch (error) {
    console.error('Error in updateCohortDisplayOrder:', error);
    throw error;
  }
};

export interface CohortIntake {
  name: string;
  description: string;
  entry_criterion: string;
  inclusions: string[];
  exclusions: string[];
}

export interface StudyConceptParseResponse {
  study_name: string;
  study_type: string;
  raw_description: string;
  codelist_notes: string;
  database: string;
  schema: string;
  cohorts: CohortIntake[];
}

export const parseStudyConcept = async (text: string, availableDatabases?: Array<{ database: string; schemas: string[] }>): Promise<StudyConceptParseResponse> => {
  try {
    const response = await api.post('/copilot/parse_concept', { text, available_databases: availableDatabases ?? [] });
    return response.data;
  } catch (error) {
    console.error('Error in parseStudyConcept:', error);
    throw error;
  }
};

export const executeStudy = async (
  studyId: string,
  onEvent?: (event: { type: 'log' | 'error' | 'complete'; message?: string; execution_id?: string }) => void,
): Promise<string | null> => {
  const response = await authFetch(`${BACKEND_URL}/study/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ study_id: studyId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Study execute failed: ${response.status} ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let executionId: string | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'complete') {
            executionId = event.execution_id ?? null;
          }
          if (onEvent) onEvent(event);
        } catch {
          // ignore malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return executionId;
};

export const generateStudyReport = async (
  studyId: string,
  executionId: string
): Promise<{ report_url?: string }> => {
  try {
    const response = await api.get('/study/report', {
      params: { study_id: studyId, execution_id: executionId },
    });
    return response.data;
  } catch (error) {
    console.error('Error in generateStudyReport:', error);
    throw error;
  }
};

export const getStudyExecutions = async (studyId: string): Promise<any[]> => {
  try {
    const response = await api.get(`/study/${studyId}/executions`);
    return response.data;
  } catch (error) {
    console.error('Error in getStudyExecutions:', error);
    throw error;
  }
};

export const getExecutionReport = async (studyId: string, executionId: string): Promise<string> => {
  const resp = await authFetch(`${BACKEND_URL}/study/${studyId}/execution/${executionId}/report`);
  if (!resp.ok) throw new Error(`${resp.status}`);
  return resp.text();
};

export const getExecutionLog = async (studyId: string, executionId: string): Promise<string> => {
  const resp = await authFetch(`${BACKEND_URL}/study/${studyId}/execution/${executionId}/log`);
  if (!resp.ok) throw new Error(`${resp.status}`);
  return resp.text();
};

export const deleteExecution = async (studyId: string, executionId: string): Promise<void> => {
  const resp = await authFetch(`${BACKEND_URL}/study/${studyId}/execution/${executionId}`, {
    method: 'DELETE',
  });
  if (!resp.ok) throw new Error(`${resp.status}`);
};

export const exportStudy = async (studyId: string, format: 'py' | 'ipynb' = 'py'): Promise<void> => {
  try {
    const response = await authFetch(`${BACKEND_URL}/study/${studyId}/export?format=${format}`);
    if (!response.ok) throw new Error(`${response.status}`);
    
    // Get the filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `study_${studyId}.${format}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    // Download the file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error in exportStudy:', error);
    throw error;
  }
};
