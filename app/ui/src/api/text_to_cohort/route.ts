import axios from 'axios';
import { LoginDataService } from '@/views/LeftPanel/UserLogin/LoginDataService';

let BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  console.warn('VITE_BACKEND_URL is undefined. Defaulting BACKEND_URL to http://localhost:8000');
  BACKEND_URL = 'http://localhost:8000';
}

export const getPublicCohorts = async () => {
  try {
    const response = await axios.get(`${BACKEND_URL}/publiccohorts`);
    return response.data;
  } catch (error) {
    console.error('Error in getPublicCohorts:', error);
    throw error;
  }
};

export const getPublicCohort = async (cohort_id: string, provisional: boolean = false) => {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/publiccohort?cohort_id=${cohort_id}&provisional=${provisional}`
    );
    return response.data;
  } catch (error) {
    console.error('Error in getPublicCohort:', error);
    throw error;
  }
};

export const getUserCohorts = async () => {
  try {
    const login_service = LoginDataService.getInstance();

    const response = await axios.get(
      `${BACKEND_URL}/cohorts?username=${login_service.getUsername()}`
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
      `${BACKEND_URL}/cohort?username=${login_service.getUsername()}&cohort_id=${cohort_id}&provisional=${provisional}`
    );
    return response.data;
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
      `${BACKEND_URL}/cohort?username=${login_service.getUsername()}&cohort_id=${cohort_id}`,
      cohort_data
    );
    return response.data;
  } catch (error) {
    console.error('Error in updateCohort:', error);
    throw error;
  }
};

export const deleteCohort = async (cohort_id: string) => {
  try {
    const login_service = LoginDataService.getInstance();
    const response = await axios.delete(
      `${BACKEND_URL}/cohort?username=${login_service.getUsername()}&cohort_id=${cohort_id}`
    );
    return response.data;
  } catch (error) {
    console.error('Error in deleteCohort:', error);
    throw error;
  }
};

export const acceptChanges = async (cohort_id: string) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/cohort/accept_changes`, {
      params: { cohort_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in acceptChanges:', error);
    throw error;
  }
};

export const rejectChanges = async (cohort_id: string) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/cohort/reject_changes`, {
      params: { cohort_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in rejectChanges:', error);
    throw error;
  }
};

export const textToCohort = async (data: any) => {
  try {
    const response = await fetch(`${BACKEND_URL}/text_to_cohort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.body) {
      throw new Error('ReadableStream not supported in this environment.');
    }

    const stream = new ReadableStream({
      start(controller) {
        const reader = response.body.getReader();

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
