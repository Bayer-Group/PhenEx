import { api } from '../httpClient';

/**
 * Get a list of all codelists for a specific cohort.
 * 
 * @param cohort_id - The ID of the cohort
 * @returns Array of codelist metadata including id, filename, codelists array, and column mappings
 * 
 * @example
 * const codelists = await getCodelistsForCohort('cohort_123');
 * // Returns: [{ id: 'codelist_1', filename: 'icd10.csv', codelists: ['diabetes'], ... }]
 */
export const getCodelistsForCohort = async (cohort_id: string) => {
  try {
    const response = await api.get(`/codelists`, {
      params: { cohort_id },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch codelists:', error);
    throw error;
  }
};

/**
 * Get the complete contents of a specific codelist file.
 * 
 * @param cohort_id - The ID of the cohort containing the codelist
 * @param file_id - The unique identifier of the codelist file
 * @returns Complete codelist object with data, column mappings, and metadata
 * 
 * @example
 * const codelist = await getCodelist('cohort_123', 'codelist_1');
 * // Returns: { id: 'codelist_1', filename: 'icd10.csv', contents: {...}, codelists: [...], ... }
 */
export const getCodelist = async (cohort_id: string, file_id: string) => {
  try {
    const response = await api.get(`/codelist`, {
      params: { cohort_id, file_id },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch codelist:', error);
    throw error;
  }
};

/**
 * Create or update a codelist file for a cohort.
 * Uses PUT for idempotent create/update operation.
 * 
 * @param cohort_id - The ID of the cohort to associate the codelist with
 * @param file - The codelist file data including id, filename, column_mapping, and codelist_data
 * @returns Success status response
 * 
 * @example
 * const file = {
 *   id: 'codelist_123',
 *   filename: 'icd10_codes.csv',
 *   column_mapping: { code_column: 'code', code_type_column: 'system', codelist_column: 'category' },
 *   codelist_data: { contents: { data: {...}, columns: [...] } }
 * };
 * await saveCodelist('cohort_123', file);
 */
export const saveCodelist = async (cohort_id: string, file: any) => {
  try {
    console.log(`Saving codelist '${file.filename}' to cohort ${cohort_id}`);
    const response = await api.put(
      `/codelist?cohort_id=${encodeURIComponent(cohort_id)}`, 
      file
    );
    console.log(`Codelist '${file.filename}' saved successfully`);
    return response.data;
  } catch (error) {
    console.error('Failed to save codelist:', error);
    throw error;
  }
};

/**
 * Delete a codelist file and all its contents.
 * 
 * @param cohort_id - The ID of the cohort containing the codelist
 * @param file_id - The unique identifier of the codelist file to delete
 * @returns Success status response
 * 
 * @example
 * await deleteCodelist('cohort_123', 'codelist_1');
 */
export const deleteCodelist = async (cohort_id: string, file_id: string) => {
  try {
    const response = await api.delete(`/codelist`, {
      params: { cohort_id, file_id },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to delete codelist:', error);
    throw error;
  }
};

/**
 * Update the column mapping configuration for an existing codelist file.
 * Automatically recalculates the unique codelists array based on the new codelist_column.
 * 
 * @param file_id - The unique identifier of the codelist file
 * @param column_mapping - New column mapping with code_column, code_type_column, codelist_column
 * @returns Success response with updated codelists array
 * 
 * @example
 * const mapping = {
 *   code_column: 'code',
 *   code_type_column: 'code_system',
 *   codelist_column: 'category'
 * };
 * const result = await updateCodelistColumnMapping('codelist_123', mapping);
 * // Returns: { status: 'success', message: '...', codelists: ['diabetes', 'hypertension'] }
 */
export const updateCodelistColumnMapping = async (
  file_id: string,
  column_mapping: {
    code_column: string;
    code_type_column: string;
    codelist_column: string;
  },
  cohort_id?: string
) => {
  try {
    console.log(`Updating column mapping for codelist ${file_id}:`, column_mapping);
    const params = new URLSearchParams({ file_id: file_id });
    if (cohort_id) params.set('cohort_id', cohort_id);
    const response = await api.patch(
      `/codelist/column_mapping?${params.toString()}`,
      column_mapping
    );
    console.log('Column mapping updated successfully');
    return response.data;
  } catch (error: any) {
    console.error('Failed to update codelist column mapping:', error);
    throw error;
  }
};

// Legacy aliases for backward compatibility (deprecated)
/** @deprecated Use getCodelistsForCohort instead */
export const getCodelistFilenamesForCohort = getCodelistsForCohort;
/** @deprecated Use getCodelist instead */
export const getCodelistFileForCohort = getCodelist;
/** @deprecated Use saveCodelist instead */
export const uploadCodelistFileToCohort = saveCodelist;
/** @deprecated Use updateCodelistColumnMapping instead */
export const updateCodelistFileColumnMapping = updateCodelistColumnMapping;