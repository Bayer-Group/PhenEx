import axios from 'axios';
import { LoginDataService } from '@/views/LeftPanel/UserLogin/LoginDataService';

let BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  console.warn('VITE_BACKEND_URL is undefined. Defaulting BACKEND_URL to http://localhost:8000');
  BACKEND_URL = 'http://localhost:8000';
}

export const getPublicCohorts = async () => {
  try {
    const response = await axios.get(`${BACKEND_URL}/cohorts/public`);
    return response.data;
  } catch (error) {
    console.error('Error in getPublicCohorts:', error);
    throw error;
  }
};

export const getPublicCohort = async (cohort_id: string, provisional: boolean = false) => {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/cohort/public?cohort_id=${cohort_id}&provisional=${provisional}`
    );
    
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
    const login_service = LoginDataService.getInstance();

    const response = await axios.get(
      `${BACKEND_URL}/cohorts?user_id=${login_service.getUserId()}`
    );
    return response.data;
  } catch (error) {
    console.error('Error in getUserCohorts:', error);
    throw error;
  }
};

export const getUserCohort = async (cohort_id: string, provisional: boolean = false) => {
  try {
    const login_service = LoginDataService.getInstance();
    const response = await axios.get(
      `${BACKEND_URL}/cohort?user_id=${login_service.getUserId()}&cohort_id=${cohort_id}&provisional=${provisional}`
    );
    
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
    const login_service = LoginDataService.getInstance();
    console.log("I AM UPDATING THE COHORT", cohort_data)
    const response = await axios.post(
      `${BACKEND_URL}/cohort?user_id=${login_service.getUserId()}&cohort_id=${cohort_id}`,
      cohort_data
    );
    return response.data.cohort_data;
  } catch (error) {
    console.error('Error in updateCohort:', error);
    throw error;
  }
};

export const deleteCohort = async (cohort_id: string) => {
  try {
    const login_service = LoginDataService.getInstance();
    const response = await axios.delete(
      `${BACKEND_URL}/cohort?user_id=${login_service.getUserId()}&cohort_id=${cohort_id}`
    );
    return response.data.cohort_data;
  } catch (error) {
    console.error('Error in deleteCohort:', error);
    throw error;
  }
};

export const acceptChanges = async (cohort_id: string) => {
  try {
    const login_service = LoginDataService.getInstance();
    const response = await axios.get(`${BACKEND_URL}/cohort/accept_changes`, {
      params: { user_id: login_service.getUserId(), cohort_id },
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
    const login_service = LoginDataService.getInstance();
    const response = await axios.get(`${BACKEND_URL}/cohort/reject_changes`, {
      params: { user_id: login_service.getUserId(), cohort_id },
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
  model: string = "gpt-4o-mini",
  return_updated_cohort: boolean = false
) => {
  try {
    const login_service = LoginDataService.getInstance();
    
    // Ensure cohort_id is a string and properly encoded
    const cohortIdString = String(cohort_id);
    const params = new URLSearchParams({
      user_id: login_service.getUserId(),
      cohort_id: cohortIdString,
      model: model,
      return_updated_cohort: String(return_updated_cohort)
    });
    
    const response = await fetch(`${BACKEND_URL}/cohort/suggest_changes?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
