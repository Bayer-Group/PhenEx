import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8000';

export const textToCohort = async (data: any) => {
  try {
    const response = await axios.post(`${BASE_URL}/text_to_cohort`, data);
    return response.data;
  } catch (error) {
    console.error('Error executing study:', error);
    throw error;
  }
};

// Add other API methods here as needed
