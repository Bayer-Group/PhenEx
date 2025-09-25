import { api } from '../httpClient';

export const getCodelistFilenamesForCohort = async (cohort_id: string) => {
  try {
    const response = await api.get(`/codelist_filesnames_for_cohort`, {
      params: { cohort_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in getCodelistFilenamesInCohort:', error);
    throw error;
  }
};

export const getCodelistFileForCohort = async (cohort_id: string, file_id: string) => {
  try {
    const response = await api.get(`/codelist_file_for_cohort`, {
      params: { cohort_id, file_id },
    });
    return response.data;
  } catch (error) {
    console.error('Error in getCodelistFileInCohort:', error);
    throw error;
  }
};

export const uploadCodelistFileToCohort = async (cohort_id: string, file: any) => {
  try {
    console.log("ATTEMPTING TO UPLOAD FILE", cohort_id, file);
    const response = await api.post(`/upload_codelist_file_to_cohort`, {
      cohort_id: cohort_id,
      file: file
    });
    console.log("SAVED FILE");
    return response.data;
  } catch (error) {
    console.error('Error in uploadCodelistFileToCohort:', error);
    // Log the full error response to see validation details
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
};