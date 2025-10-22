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
    // Send as query parameter + body
    const response = await api.post(
      `/upload_codelist_file_to_cohort?cohort_id=${encodeURIComponent(cohort_id)}`, 
      file  // Send just the file object as the body
    );
    console.log("SAVED FILE", response);
    return response.data;
  } catch (error) {
    console.error('Error in uploadCodelistFileToCohort:', error);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
};

export const updateCodelistFileColumnMapping = async (file_id: string, column_mapping: {
  code_column: string;
  code_type_column: string;
  codelist_column: string;
}) => {
  try {
    console.log("UPDATING COLUMN MAPPING", file_id, column_mapping);
    const response = await api.patch(
      `/codelist_file_column_mapping?file_id=${encodeURIComponent(file_id)}`,
      column_mapping
    );
    console.log("UPDATED COLUMN MAPPING", response);
    return response.data;
  } catch (error: any) {
    console.error('Error in updateCodelistFileColumnMapping:', error);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
};