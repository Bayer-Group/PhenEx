import axios from 'axios';

let BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  console.warn('VITE_BACKEND_URL is undefined. Defaulting BACKEND_URL to http://localhost:8000');
  BACKEND_URL = 'http://localhost:8000';
}

export const executeStudy = async (data: any) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/execute_study`, data);
    return response.data;
  } catch (error) {
    console.error('Error executing study:', error);
    throw error;
  }
};

// Add other API methods here as needed
