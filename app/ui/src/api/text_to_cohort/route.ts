import axios from 'axios';

const BASE_URL = 'http://localhost:8000';


export const getCohorts = async () => {
  try {
    console.log('Sending request to getCohorts with data:');
    const response = await axios.get(`${BASE_URL}/cohorts`);
    console.log('Received response from getCohorts:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in getCohorts:', error);
    throw error;
  }
};


export const getCohort = async (cohort_id: string) => {
  try {
    console.log('Sending request to getCohorts with data:');
    const response = await axios.get(`${BASE_URL}/cohort?cohort_id=${cohort_id}`);
    console.log('Received response from getCohorts:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in getCohorts:', error);
    throw error;
  }
};


export const updateCohort = async (cohort_id: string, cohort_data: any) => {
  try {
    console.log('Sending request to updateCohort with data:', cohort_data);
    const response = await axios.post(`${BASE_URL}/cohort?cohort_id=${cohort_id}`, cohort_data);
    console.log('Received response from updateCohort:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in updateCohort:', error);
    throw error;
  }
};

export const deleteCohort = async (cohort_id: string) => {
  try {
    console.log('Sending request to deleteCohort with data:', cohort_id);
    const response = await axios.delete(`${BASE_URL}/cohort?cohort_id=${cohort_id}`);
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
    const response = await axios.get(`${BASE_URL}/cohort/accept_changes`, {
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
    const response = await axios.get(`${BASE_URL}/cohort/reject_changes`, {
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
    const response = await fetch(`${BASE_URL}/text_to_cohort`, {
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
