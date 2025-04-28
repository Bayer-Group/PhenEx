import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

export const getCodelistFilenamesForCohort = async (cohort_id: string) => {
  try {
    console.log('Sending request to getCodelistFilenamesForCohort with data:', cohort_id);
    const response = await axios.get(
      `${BASE_URL}/codelist_filesnames_for_cohort?cohort_id=${cohort_id}`
    );
    console.log('Received response from getCodelistFilenamesForCohort:', response.data, cohort_id);
    return response.data;
  } catch (error) {
    console.error('Error in getCodelistFilenamesInCohort:', error);
    throw error;
  }
};

export const getCodelistFileForCohort = async (cohort_id: string, file_id:string) => {
  try {
    console.log('Sending request to getCodelistFileForCohort with data:', cohort_id, file_id);
    const response = await axios.get(
      `${BASE_URL}/codelist_file_for_cohort?cohort_id=${cohort_id}&file_id=${file_id}`
    );
    console.log('Received response from getCodelistFileForCohort:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in getCodelistFileInCohort:', error);
    throw error;
  }
};

export const uploadCodelistFileToCohort = async (cohort_id: string, file:any) => {
  try {
    console.log('Sending request to uploadCodelistFileToCohort with data:');
    const response = await axios.post(
      `${BASE_URL}/upload_codelist_file_to_cohort?cohort_id=${cohort_id}`,file
    );
    console.log('Received response from getCohorts:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in uploadCodelistFileToCohort:', error);
    throw error;
  }
};