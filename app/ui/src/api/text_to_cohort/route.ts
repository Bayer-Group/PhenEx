import axios from 'axios';
import { LoginDataService } from '../../views/LeftPanel/UserLogin/LoginDataService';

let BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  console.warn('VITE_BACKEND_URL is undefined. Defaulting BACKEND_URL to http://localhost:8000');
  BACKEND_URL = 'http://localhost:8000';
}

export const getPublicCohorts = async () => {
  try {
    console.log('Sending request to getPublicCohorts with data:');
    const response = await axios.get(`${BACKEND_URL}/publiccohorts`);
    console.log('Received response from getPublicCohorts:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in getPublicCohorts:', error);
    throw error;
  }
};

export const getPublicCohort = async (cohort_id: string, provisional: boolean = false) => {
  try {
    console.log('Sending request to getPublicCohort with data:');
    const response = await axios.get(
      `${BACKEND_URL}/publiccohort?cohort_id=${cohort_id}&provisional=${provisional}`
    );
    console.log('Received response from getPublicCohort:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in getPublicCohort:', error);
    throw error;
  }
};

export const getUserCohorts = async () => {
  try {
    const login_service = LoginDataService.getInstance()

    console.log('Sending request to getUserCohorts with data:');
    const response = await axios.get(`${BACKEND_URL}/cohorts?username=${login_service.getUsername()}`);
    console.log('Received response from getUserCohorts:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in getUserCohorts:', error);
    throw error;
  }
};

export const getUserCohort = async (cohort_id: string, provisional: boolean = false) => {
  try {
    const login_service = LoginDataService.getInstance()
    console.log('Sending request to getUserCohort with data:');
    const response = await axios.get(
      `${BACKEND_URL}/cohort?username=${login_service.getUsername()}&cohort_id=${cohort_id}&provisional=${provisional}`
    );
    console.log('Received response from getUserCohort:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in getUserCohort:', error);
    throw error;
  }
};

export const updateCohort = async (cohort_id: string, cohort_data: any) => {
  try {
      const login_service = LoginDataService.getInstance()
    console.log('Sending request to updateCohort with data:', cohort_data);
    const response = await axios.post(`${BACKEND_URL}/cohort?username=${login_service.getUsername()}&cohort_id=${cohort_id}`, cohort_data);
    console.log('Received response from updateCohort:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in updateCohort:', error);
    throw error;
  }
};

export const deleteCohort = async (cohort_id: string) => {
  try {
    const login_service = LoginDataService.getInstance()
    console.log('Sending request to deleteCohort with data:', cohort_id);
    const response = await axios.delete(`${BACKEND_URL}/username=${login_service.getUsername()}&cohort?cohort_id=${cohort_id}`);
    console.log('Received response from deleteCohort:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in deleteCohort:', error);
    throw error;
  }
};

export const acceptChanges = async (cohort_id: string) => {
  try {
    console.log('Sending request to acceptChanges with cohort_id:', cohort_id);
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
    console.log('Sending request to rejectChanges with cohort_id:', cohort_id);
    const response = await axios.get(`${BACKEND_URL}/cohort/reject_changes`, {
      params: { cohort_id },
    });
    console.log('Received response from rejectChanges:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in rejectChanges:', error);
    throw error;
  }
};

export const textToCohort = async (data: any) => {
  try {
    console.log('Sending request to planUpdateCohort with data:', data);
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

    console.log('Received streaming response from planUpdateCohort');
    const stream = new ReadableStream({
      start(controller) {
        const reader = response.body.getReader();

        const read = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('Streaming ended');
              controller.close();
              break;
            }
            console.log('Streaming chunk received:', new TextDecoder().decode(value));
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
