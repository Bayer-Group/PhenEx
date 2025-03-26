import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

export const getCohort = async (cohort_id: string, provisional: boolean) => {
  try {
    console.log('Sending request to getCohort with cohort_id:', cohort_id, 'and provisional:', provisional);
    const response = await axios.get(`${BASE_URL}/cohort`, {
      params: { cohort_id, provisional },
    });
    console.log('Received response from getCohort:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in getCohort:', error);
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
