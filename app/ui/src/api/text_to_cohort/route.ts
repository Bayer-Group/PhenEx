import { api, authFetch, buildUrl } from '../httpClient';

export const getPublicCohorts = async () => {
  try {
    const response = await api.get('/cohorts/public');
    return response.data;
  } catch (error) {
    console.error('Error in getPublicCohorts:', error);
    throw error;
  }
};

export const getPublicCohort = async (cohort_id: string, provisional: boolean = false) => {
  try {
    const response = await api.get('/cohort/public', {
      params: { cohort_id, provisional },
    });

    // Parse the cohort_data field if it exists and is a string
    if (response.data.cohort_data && typeof response.data.cohort_data === 'string') {
      return JSON.parse(response.data.cohort_data);
    }

    // Fallback to return the original data if cohort_data is not present or already parsed
    return response.data.cohort_data || response.data;
  } catch (error) {
    console.error('Error in getPublicCohort:', error);
    throw error;
  }
};

export const getUserCohorts = async () => {
  try {
    const response = await api.get('/cohorts');
    return response.data;
  } catch (error) {
    console.error('Error in getUserCohorts:', error);
    throw error;
  }
};

export const getUserCohort = async (cohort_id: string, provisional: boolean = false) => {
  try {
    const response = await api.get('/cohort', {
      params: { cohort_id, provisional },
    });

    // Parse the cohort_data field if it exists and is a string
    if (response.data.cohort_data && typeof response.data.cohort_data === 'string') {
      return JSON.parse(response.data.cohort_data);
    }

    // Fallback to return the original data if cohort_data is not present or already parsed
    return response.data.cohort_data || response.data;
  } catch (error) {
    console.error('Error in getUserCohort:', error);
    throw error;
  }
};

export const updateCohort = async (cohort_id: string, cohort_data: any) => {
  try {
    console.log('I AM UPDATING THE COHORT', cohort_data);
    const response = await api.post('/cohort', cohort_data, {
      params: { cohort_id },
    });
    return response.data.cohort_data;
  } catch (error) {
    console.error('Error in updateCohort:', error);
    throw error;
  }
};

export const deleteCohort = async (cohort_id: string) => {
  try {
    const response = await api.delete('/cohort', {
      params: { cohort_id },
    });
    return response.data.cohort_data;
  } catch (error) {
    console.error('Error in deleteCohort:', error);
    throw error;
  }
};

export const acceptChanges = async (cohort_id: string) => {
  try {
    const response = await api.get('/cohort/accept_changes', {
      params: { cohort_id },
    });

    // Parse the cohort_data field if it exists and is a string
    if (response.data.cohort_data && typeof response.data.cohort_data === 'string') {
      return JSON.parse(response.data.cohort_data);
    }

    // Fallback to return the original data if cohort_data is not present or already parsed
    return response.data.cohort_data || response.data;
  } catch (error) {
    console.error('Error in acceptChanges:', error);
    throw error;
  }
};

export const rejectChanges = async (cohort_id: string) => {
  try {
    const response = await api.get('/cohort/reject_changes', {
      params: { cohort_id },
    });

    // Parse the cohort_data field if it exists and is a string
    if (response.data.cohort_data && typeof response.data.cohort_data === 'string') {
      return JSON.parse(response.data.cohort_data);
    }

    // Fallback to return the original data if cohort_data is not present or already parsed
    return response.data.cohort_data || response.data;
  } catch (error) {
    console.error('Error in rejectChanges:', error);
    throw error;
  }
};

export const suggestChanges = async (
  cohort_id: string,
  user_request: string,
  model: string = 'gpt-4o-mini',
  return_updated_cohort: boolean = false
) => {
  try {
    // Ensure cohort_id is a string and properly encoded
    const cohortIdString = String(cohort_id);
    const url = buildUrl('/cohort/suggest_changes', {
      cohort_id: cohortIdString,
      model,
      return_updated_cohort: String(return_updated_cohort),
    });

    const response = await authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: user_request,
    });

    if (!response.body) {
      throw new Error('ReadableStream not supported in this environment.');
    }

    const stream = new ReadableStream({
      start(controller) {
        const reader = response.body!.getReader();

        const read = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }
            controller.enqueue(value);
          }
        };

        read().catch(error => {
          console.error('Error during streaming:', error);
          controller.error(error);
        });
      },
    });

    return stream;
  } catch (error) {
    console.error('Error in planUpdateCohort:', error);
    throw error;
  }
};

// ========== STUDY API CALLS ==========

export const getUserStudies = async () => {
  try {
    const response = await api.get('/studies');
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
    const response = await api.get('/study', {
      params: { study_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in getStudy:', error);
    throw error;
  }
};

export const getPublicStudy = async (study_id: string) => {
  try {
    const response = await api.get('/study/public', {
      params: { study_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in getPublicStudy:', error);
    throw error;
  }
};

export const updateStudy = async (study_id: string, study_data: any) => {
  try {
    console.log('Updating study:', study_data);
    const response = await api.post('/study', study_data, {
      params: { study_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in updateStudy:', error);
    throw error;
  }
};

export const deleteStudy = async (study_id: string) => {
  try {
    const response = await api.delete('/study', {
      params: { study_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in deleteStudy:', error);
    throw error;
  }
};

export const getCohortsForStudy = async (study_id: string) => {
  try {
    const response = await api.get('/study/cohorts', {
      params: { study_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in getCohortsForStudy:', error);
    throw error;
  }
};

export const createNewStudy = async (study_data: any) => {
  try {
    console.log('Creating new study:', study_data);
    const response = await api.post('/study/new', study_data);
    return response.data;
  } catch (error) {
    console.error('Error in createNewStudy:', error);
    throw error;
  }
};
