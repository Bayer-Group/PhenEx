import axios from 'axios';

let BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  console.warn('VITE_BACKEND_URL is undefined. Defaulting BACKEND_URL to http://localhost:8000');
  BACKEND_URL = 'http://localhost:8000';
}

export const getCodelistFilenamesForCohort = async (cohort_id: string) => {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/codelist_filesnames_for_cohort?cohort_id=${cohort_id}`
    );
    return response.data;
  } catch (error) {
    console.error('Error in getCodelistFilenamesInCohort:', error);
    throw error;
  }
};

export const getCodelistFileForCohort = async (cohort_id: string, file_id: string) => {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/codelist_file_for_cohort?cohort_id=${cohort_id}&file_id=${file_id}`
    );
    return response.data;
  } catch (error) {
    console.error('Error in getCodelistFileInCohort:', error);
    throw error;
  }
};

export const uploadCodelistFileToCohort = async (cohort_id: string, file: any) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/upload_codelist_file_to_cohort?cohort_id=${cohort_id}`,
      file
    );
    return response.data;
  } catch (error) {
    console.error('Error in uploadCodelistFileToCohort:', error);
    throw error;
  }
};
