import { api, authFetch } from '../httpClient';

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
      response.data.cohort_data = JSON.parse(response.data.cohort_data);
    }

    // Return the full response data which includes is_provisional, version, etc.
    // The cohort_data field is nested inside
    return response.data;
  } catch (error) {
    console.error('Error in getUserCohort:', error);
    throw error;
  }
};

export const createCohort = async (cohort_id: string, cohort_data: any, study_id: string) => {
  try {
    console.log('I AM CREATING THE COHORT', cohort_data);
    const response = await api.post('/cohort', cohort_data, {
      params: { cohort_id, study_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in createCohort:', error);
    throw error;
  }
};

export const updateCohort = async (cohort_id: string, cohort_data: any) => {
  try {
    console.log('I AM UPDATING THE COHORT', cohort_data);
    const response = await api.patch('/cohort', cohort_data, {
      params: { cohort_id },
    });
    return response.data;
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
    const response = await api.get('/cohort/reject_changes', {
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

export const suggestChanges = async (
  cohort_id: string,
  user_request: string,
  model: string = 'gpt-4o-mini',
  return_updated_cohort: boolean = false,
  conversation_history?: Array<{user?: string; system?: string; user_action?: string}>,
  cohort_description?: string
) => {
  try {
    console.log('suggestChanges: Starting request with params:', {
      cohort_id: String(cohort_id),
      model,
      return_updated_cohort: String(return_updated_cohort),
      user_request_length: user_request.length,
      history_length: conversation_history?.length || 0,
      has_description: !!cohort_description
    });

    // Build the URL correctly by combining baseURL and endpoint path
    const baseURL = api.defaults.baseURL || '';
    let fullURL = baseURL;
    
    // Ensure proper path joining - remove trailing slash from base, add leading slash to endpoint
    if (fullURL.endsWith('/')) {
      fullURL = fullURL.slice(0, -1);
    }
    fullURL += '/cohort/suggest_changes';
    
    // Build the URL with query parameters
    const url = new URL(fullURL);
    url.searchParams.set('cohort_id', String(cohort_id));
    url.searchParams.set('model', model);
    url.searchParams.set('return_updated_cohort', String(return_updated_cohort));

    // Prepare the request body with conversation history and cohort description
    const requestBody = {
      user_request,
      conversation_history: conversation_history || [],
      cohort_description: cohort_description || null
    };

    // Use authFetch for streaming responses with proper authentication
    const response = await authFetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('suggestChanges: Received response, status:', response.status);

    if (!response.ok) {
      console.error('suggestChanges: Request failed with status:', response.status);
      throw new Error(`Request failed with status code ${response.status}`);
    }

    if (!response.body) {
      console.error('suggestChanges: No response body received');
      throw new Error('No response body received.');
    }

    console.log('suggestChanges: Returning ReadableStream from response');
    return response.body;
  } catch (error: any) {
    console.error('suggestChanges: Error occurred:', {
      message: error?.message || 'Unknown error',
      status: error?.status,
      statusText: error?.statusText,
      error: error
    });
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

export const updateStudyDisplayOrder = async (study_id: string, display_order: number) => {
  try {
    const response = await api.patch('/study/display_order', null, {
      params: { study_id, display_order },
    });
    return response.data;
  } catch (error) {
    console.error('Error in updateStudyDisplayOrder:', error);
    throw error;
  }
};
