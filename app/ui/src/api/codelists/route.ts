import { api } from '../httpClient';

/**
 * Get a list of all codelists for a specific study.
 * 
 * @param study_id - The ID of the study
 * @returns Array of codelist metadata including id, filename, codelists array, and column mappings
 * 
 * @example
 * const codelists = await getCodelistsForStudy('study_123');
 * // Returns: [{ id: 'codelist_1', filename: 'icd10.csv', codelists: ['diabetes'], ... }]
 */
export const getCodelistsForStudy = async (study_id: string) => {
  try {
    const response = await api.get(`/study/${study_id}/codelists`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch codelists for study:', error);
    throw error;
  }
};

/**
 * Get the complete contents of a specific codelist file.
 * 
 * @param study_id - The ID of the study containing the codelist
 * @param file_id - The unique identifier of the codelist file
 * @returns Complete codelist object with data, column mappings, and metadata
 * 
 * @example
 * const codelist = await getCodelist('study_123', 'codelist_1');
 * // Returns: { id: 'codelist_1', filename: 'icd10.csv', contents: {...}, codelists: [...], ... }
 */
export const getCodelist = async (study_id: string, file_id: string) => {
  try {
    const response = await api.get(`/study/${study_id}/codelist/${file_id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch codelist:', error);
    throw error;
  }
};

/**
 * Create or update a codelist file for a study.
 * Uses PUT for idempotent create/update operation.
 * 
 * @param file - The codelist file data including id, filename, column_mapping, and codelist_data
 * @param study_id - The ID of the study to associate the codelist with
 * @returns Success status response
 * 
 * @example
 * const file = {
 *   id: 'codelist_123',
 *   filename: 'icd10_codes.csv',
 *   code_column: 'code',
 *   code_type_column: 'system',
 *   codelist_column: 'category',
 *   contents: { data: {...}, headers: [...] }
 * };
 * await saveCodelist(file, 'study_123');
 */
export const saveCodelist = async (file: any, study_id: string) => {
  try {
    if (!study_id) {
      throw new Error('study_id is required to save codelist');
    }
    console.log(`Saving codelist '${file.filename}' for study ${study_id}`);
    const response = await api.put(`/study/${study_id}/codelist`, file);
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
 * @param study_id - The ID of the study containing the codelist
 * @param file_id - The unique identifier of the codelist file to delete
 * @returns Success status response
 * 
 * @example
 * await deleteCodelist('study_123', 'codelist_1');
 */
export const deleteCodelist = async (study_id: string, file_id: string) => {
  try {
    const response = await api.delete(`/study/${study_id}/codelist/${file_id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete codelist:', error);
    throw error;
  }
};

/**
 * Update the display order of a codelist file.
 * 
 * @param study_id - The ID of the study containing the codelist
 * @param file_id - The unique identifier of the codelist file
 * @param display_order - The new display order value
 * @returns Success status response
 * 
 * @example
 * await updateCodelistDisplayOrder('study_123', 'codelist_1', 2);
 */
export const updateCodelistDisplayOrder = async (
  study_id: string,
  file_id: string,
  display_order: number
) => {
  try {
    console.log(`Updating display order for codelist ${file_id} in study ${study_id} to ${display_order}`);
    const response = await api.patch(
      `/study/${study_id}/codelist/${file_id}/display_order`,
      null,
      {
        params: { display_order },
      }
    );
    console.log('Display order updated successfully');
    return response.data;
  } catch (error: any) {
    console.error('Failed to update codelist display order:', error);
    throw error;
  }
};

/**
 * Update the column mapping configuration for an existing codelist file.
 * Automatically recalculates the unique codelists array based on the new codelist_column.
 * 
 * @param study_id - The ID of the study containing the codelist
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
 * const result = await updateCodelistColumnMapping('study_123', 'codelist_123', mapping);
 * // Returns: { status: 'success', message: '...', codelists: ['diabetes', 'hypertension'] }
 */
export const updateCodelistColumnMapping = async (
  study_id: string,
  file_id: string,
  column_mapping: {
    code_column: string;
    code_type_column: string;
    codelist_column: string;
  }
) => {
  try {
    console.log(`Updating column mapping for codelist ${file_id} in study ${study_id}:`, column_mapping);
    const response = await api.patch(
      `/study/${study_id}/codelist/${file_id}/column_mapping`,
      column_mapping
    );
    console.log('Column mapping updated successfully');
    return response.data;
  } catch (error: any) {
    console.error('Failed to update codelist column mapping:', error);
    throw error;
  }
};