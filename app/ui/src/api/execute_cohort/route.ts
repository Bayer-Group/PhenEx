import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8000';

export const executeStudy = async (data: any) => {
  try {
    const response = await axios.post(`${BASE_URL}/execute_study`, data);
    return response.data;
  } catch (error) {
    console.error('Error executing study:', error);
    throw error;
  }
};

// Add other API methods here as needed